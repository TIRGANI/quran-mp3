#!/usr/bin/env python3
"""
Génère des horaires mot par mot (alignement forcé audio/texte) pour les fichiers
audio de mp3quran.net, afin que l'app web puisse surligner exactement le mot en
train d'être récité, sans dépendre des horaires de quran.com (mesurés sur un
enregistrement différent, au rythme différent).

Principe : pour chaque (récitateur, sourate), on télécharge le mp3 réellement
servi par le site, on aligne le texte uthmanî connu (alquran.cloud) dessus avec
un modèle CTC (wav2vec2 romanisé, via le paquet ctc-forced-aligner), puis on
découpe le résultat mot par mot en horaires JSON par verset — directement dans
le référentiel temporel du fichier joué, donc sans aucun recalage nécessaire
côté navigateur.

Usage :
    python3 align_quran.py --reciters mishary-alafasy/r1 --surahs 1-3
    python3 align_quran.py --all                              # tout, 64 récitateurs x 114 sourates
    python3 align_quran.py --list-reciters
    python3 align_quran.py --reciters mishary-alafasy/r1 --surahs 1 --overwrite

Sortie : scripts/timings/<reciter-id-aplati>/<surah>.json
    { "duration_ms": 51931, "ayahs": { "1": [{"w": "بِسۡمِ", "from": 6420, "to": 6760}, ...], ... } }

Dépendances (voir requirements.txt) : torch, numpy, requests, tqdm, ctc-forced-aligner, unidecode,
+ ffmpeg/ffprobe dans le PATH (`brew install ffmpeg`) pour découper les longues sourates en morceaux.
Le premier lancement télécharge le modèle d'alignement (~1.2 Go) dans ~/ctc_forced_aligner/.

Les sourates longues (> CHUNK_THRESHOLD_S) sont découpées en morceaux d'environ
CHUNK_TARGET_S, avec un recouvrement, pour borner le temps et la mémoire : aligner
d'un coup les ~2h d'Al-Baqara fait exploser la mémoire (observé : >11 Go, jamais
terminé en pratique) à cause du coût O(T×L) de l'alignement CTC.

Pour accélérer avec un GPU NVIDIA : `pip install onnxruntime-gpu` (au lieu de la
version CPU incluse par ctc-forced-aligner) avant de lancer ce script.
"""
import argparse
import json
import logging
import re
import shutil
import subprocess
import sys
import tempfile
import time
import traceback
import unicodedata
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
INDEX_HTML = ROOT / "index.html"
OUT_DIR = Path(__file__).resolve().parent / "timings"
CACHE_DIR = Path(__file__).resolve().parent / ".cache"
TEXT_CACHE = CACHE_DIR / "quran_text.json"
FAIL_LOG = Path(__file__).resolve().parent / "align_failures.log"

TOTAL_SURAHS = 114
WAQF_MARKS = "ۚۖۗۛۙۘ"  # ۚۖۗۛۙۘ
WAQF_RE = re.compile(f"^[{WAQF_MARKS}]+$")

# Au-delà de cette durée, la sourate est découpée en morceaux pour l'alignement
# (voir docstring du module). En dessous, elle est alignée d'un coup (plus simple,
# et déjà rapide : la grande majorité des 114 sourates sont courtes).
CHUNK_THRESHOLD_S = 420
CHUNK_TARGET_S = 300
CHUNK_PAD_S = 8

logging.basicConfig(level=logging.WARNING, format="%(levelname)s: %(message)s")
log = logging.getLogger("align_quran")


# ---------- Récitateurs : lus directement dans index.html, pour rester synchronisé avec le site ----------

def load_reciters():
    text = INDEX_HTML.read_text(encoding="utf-8")
    m = re.search(r"const RECITERS = \[(.*?)\]\.map\(", text, re.S)
    if not m:
        raise RuntimeError("Impossible de trouver RECITERS dans index.html")
    body = m.group(1)
    reciters = []
    for line in body.splitlines():
        line = line.strip()
        if not line.startswith("["):
            continue
        fields = re.findall(r"'((?:[^'\\]|\\.)*)'", line)
        if len(fields) < 5:
            continue
        rid, fr = fields[0], fields[1]
        if "Almusshaf-Al-Mo-lim" in rid:
            continue  # récitation Hifdh (chaque verset répété) : pas alignable tel quel
        reciters.append({"id": rid, "fr": fr})
    return reciters


def audio_url(reciter_id: str, n: int) -> str:
    base = f"{reciter_id}/" if reciter_id.startswith("https:") else f"https://cdn.mp3quran.net/audio/{reciter_id}/"
    return f"{base}{n:03d}.mp3"


def safe_dirname(reciter_id: str) -> str:
    return re.sub(r"[^a-zA-Z0-9_.-]+", "_", reciter_id)


# ---------- Texte de référence (alquran.cloud, texte uthmanî — même source que l'app) ----------

def tokenize_words(text: str):
    words = []
    for tok in text.split():
        if WAQF_RE.match(tok) and words:
            words[-1] += tok
        else:
            words.append(tok)
    return words


def load_all_surah_texts(session: requests.Session):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    if TEXT_CACHE.exists():
        return json.loads(TEXT_CACHE.read_text(encoding="utf-8"))
    texts = {}
    for n in range(1, TOTAL_SURAHS + 1):
        for attempt in range(5):
            try:
                r = session.get(
                    f"https://api.alquran.cloud/v1/surah/{n}/quran-uthmani", timeout=20
                )
                r.raise_for_status()
                ayahs = r.json()["data"]["ayahs"]
                texts[str(n)] = [a["text"].lstrip("﻿").strip() for a in ayahs]
                break
            except Exception as e:
                if attempt == 4:
                    raise RuntimeError(f"Texte sourate {n} indisponible : {e}")
                time.sleep(2 * (attempt + 1))
        print(f"\rTexte de référence : sourate {n}/{TOTAL_SURAHS}", end="", flush=True)
    print()
    TEXT_CACHE.write_text(json.dumps(texts, ensure_ascii=False), encoding="utf-8")
    return texts


# ---------- Téléchargement audio ----------

def download_audio(url: str, dest: Path, session: requests.Session) -> bool:
    for attempt in range(4):
        try:
            r = session.get(url, timeout=60, stream=True)
            if r.status_code == 404:
                return False
            r.raise_for_status()
            with open(dest, "wb") as f:
                for chunk in r.iter_content(chunk_size=1 << 16):
                    f.write(chunk)
            return True
        except Exception as e:
            if attempt == 3:
                raise
            time.sleep(3 * (attempt + 1))
    return False


# ---------- Alignement ----------

def ffprobe_duration(path: Path) -> float:
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
        capture_output=True, text=True, check=True,
    )
    return float(out.stdout.strip())


def ffmpeg_slice(src: Path, dst: Path, start_s: float, end_s: float):
    subprocess.run(
        [
            "ffmpeg", "-y", "-v", "error",
            "-ss", f"{max(0, start_s):.3f}", "-to", f"{end_s:.3f}", "-i", str(src),
            "-ar", "16000", "-ac", "1", "-vn", str(dst),
        ],
        check=True,
    )


def align_words(aligner, audio_path: Path, words_text):
    """Aligne une liste de mots sur un fichier audio (ou morceau). Renvoie une liste
    de dicts {text, start, end} (secondes, relatives au début du fichier passé)."""
    import ctc_forced_aligner as cfa

    audio = cfa.load_audio(str(audio_path))
    emissions, stride = cfa.generate_emissions(aligner.model, audio, batch_size=8)
    full_text = " ".join(words_text)
    tokens_starred, text_starred = cfa.preprocess_text(full_text, romanize=True, language="ara")
    segments, scores, blank = cfa.get_alignments(emissions, tokens_starred, aligner.tokenizer)
    spans = cfa.get_spans(tokens_starred, segments, blank)
    words = cfa.postprocess_results(text_starred, spans, stride, scores)
    if len(words) != len(words_text):
        raise RuntimeError(f"{len(words)} mots alignés != {len(words_text)} attendus")
    return words


def estimate_ayah_time_ranges(ayah_word_lists, duration_s: float):
    """Position estimée (secondes) de chaque verset, proportionnelle à sa longueur en
    caractères — seulement pour choisir où découper, jamais utilisé comme horaire final."""
    lens = [sum(len(w) for w in words) or 1 for words in ayah_word_lists]
    total = sum(lens) or 1
    ranges, acc = [], 0
    for l in lens:
        start = acc / total * duration_s
        acc += l
        end = acc / total * duration_s
        ranges.append((start, end))
    return ranges


def build_chunks(ayah_word_lists, duration_s: float):
    """Regroupe les versets consécutifs en morceaux d'environ CHUNK_TARGET_S, avec un
    padding de chaque côté pour ne jamais couper un mot. Renvoie une liste de
    {ayah_start, ayah_end (exclu), slice_start_s, slice_end_s}."""
    ranges = estimate_ayah_time_ranges(ayah_word_lists, duration_s)
    chunks = []
    i, n = 0, len(ranges)
    while i < n:
        j = i
        chunk_start = ranges[i][0]
        while j < n and (ranges[j][1] - chunk_start) < CHUNK_TARGET_S:
            j += 1
        j = max(j, i + 1)  # au moins un verset par morceau, même si trop long à lui seul
        chunk_end = ranges[j - 1][1]
        slice_start = max(0.0, chunk_start - CHUNK_PAD_S)
        slice_end = min(duration_s, chunk_end + CHUNK_PAD_S)
        chunks.append({"ayah_start": i, "ayah_end": j, "slice_start_s": slice_start, "slice_end_s": slice_end})
        i = j
    return chunks


def align_file(aligner, audio_path: Path, ayah_word_lists):
    """Aligne une sourate entière : d'un coup si assez courte, sinon en morceaux
    (cf. docstring du module). Renvoie (mots alignés dans l'ordre, durée totale ms)."""
    duration_s = ffprobe_duration(audio_path)
    duration_ms = round(duration_s * 1000)
    full_words_text = [w for lst in ayah_word_lists for w in lst]

    if duration_s <= CHUNK_THRESHOLD_S:
        return align_words(aligner, audio_path, full_words_text), duration_ms

    chunks = build_chunks(ayah_word_lists, duration_s)
    all_words = []
    with tempfile.TemporaryDirectory() as tmp:
        for ci, chunk in enumerate(chunks):
            chunk_words_text = [w for lst in ayah_word_lists[chunk["ayah_start"]: chunk["ayah_end"]] for w in lst]
            if not chunk_words_text:
                continue
            slice_path = Path(tmp) / f"chunk_{ci}.wav"
            ffmpeg_slice(audio_path, slice_path, chunk["slice_start_s"], chunk["slice_end_s"])
            words = align_words(aligner, slice_path, chunk_words_text)
            for w in words:
                w["start"] += chunk["slice_start_s"]
                w["end"] += chunk["slice_start_s"]
            all_words.extend(words)
            slice_path.unlink(missing_ok=True)

    if len(all_words) != len(full_words_text):
        raise RuntimeError(f"{len(all_words)} mots alignés != {len(full_words_text)} attendus (découpage)")
    return all_words, duration_ms


def split_into_ayahs(words, ayah_word_counts):
    """words : liste plate alignée mot à mot avec la concaténation de toutes les sourates.
    ayah_word_counts : [(numéro_ayah, nb_mots), ...] dans l'ordre. Renvoie {ayah: [mots...]}"""
    out = {}
    i = 0
    for ayah, count in ayah_word_counts:
        chunk = words[i : i + count]
        out[str(ayah)] = [
            {"w": w["text"], "from": round(w["start"] * 1000), "to": round(w["end"] * 1000)}
            for w in chunk
        ]
        i += count
    return out


def process_surah(aligner, reciter, n, ayah_texts, out_dir: Path, session, overwrite: bool, keep_audio: bool):
    out_path = out_dir / safe_dirname(reciter["id"]) / f"{n}.json"
    if out_path.exists() and not overwrite:
        return "skip"

    ayah_word_lists = [tokenize_words(t) for t in ayah_texts]
    ayah_word_counts = [(i + 1, len(w)) for i, w in enumerate(ayah_word_lists)]
    full_words = [w for lst in ayah_word_lists for w in lst]
    if not full_words:
        return "skip"

    url = audio_url(reciter["id"], n)
    with tempfile.TemporaryDirectory() as tmp:
        audio_path = Path(tmp) / "audio.mp3"
        if not download_audio(url, audio_path, session):
            raise RuntimeError(f"Audio introuvable : {url}")
        words, duration_ms = align_file(aligner, audio_path, ayah_word_lists)
        if keep_audio:
            kept = out_dir / safe_dirname(reciter["id"]) / f"{n}.mp3"
            kept.parent.mkdir(parents=True, exist_ok=True)
            kept.write_bytes(audio_path.read_bytes())

    ayahs = split_into_ayahs(words, ayah_word_counts)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps({"duration_ms": duration_ms, "ayahs": ayahs}, ensure_ascii=False),
        encoding="utf-8",
    )
    return "ok"


def parse_surah_range(spec: str):
    out = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-")
            out.update(range(int(a), int(b) + 1))
        elif part:
            out.add(int(part))
    return sorted(n for n in out if 1 <= n <= TOTAL_SURAHS)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--reciters", help="IDs séparés par des virgules (ex: mishary-alafasy/r1,saud-shuraim/r1)")
    p.add_argument("--all", action="store_true", help="Tous les récitateurs")
    p.add_argument("--surahs", default="1-114", help="Ex: 1-114 (défaut), 1,2,5, ou 78-114")
    p.add_argument("--out", default=str(OUT_DIR), help="Dossier de sortie")
    p.add_argument("--overwrite", action="store_true", help="Regénère même si le JSON existe déjà")
    p.add_argument("--keep-audio", action="store_true", help="Garde aussi le mp3 téléchargé (gros volume)")
    p.add_argument("--list-reciters", action="store_true", help="Liste les IDs disponibles et quitte")
    p.add_argument("--time-budget-min", type=float, default=0,
                   help="S'arrête proprement (entre deux sourates) après N minutes, pour tenir dans la limite "
                        "d'un job CI (ex: GitHub Actions, 6h max) ; 0 = pas de limite (défaut)")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()

    if args.verbose:
        log.setLevel(logging.INFO)

    if not (shutil.which("ffmpeg") and shutil.which("ffprobe")):
        sys.exit("ffmpeg/ffprobe introuvables dans le PATH (nécessaires pour les longues sourates) : brew install ffmpeg")

    reciters = load_reciters()
    if args.list_reciters:
        for r in reciters:
            print(f"{r['id']:45s} {r['fr']}")
        return

    if args.all:
        chosen = reciters
    elif args.reciters:
        ids = {x.strip() for x in args.reciters.split(",")}
        chosen = [r for r in reciters if r["id"] in ids]
        missing = ids - {r["id"] for r in chosen}
        if missing:
            sys.exit(f"Récitateur(s) inconnu(s) : {', '.join(missing)} (--list-reciters pour la liste)")
    else:
        sys.exit("Précise --reciters <id,...> ou --all (voir --list-reciters)")

    surahs = parse_surah_range(args.surahs)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    session = requests.Session()
    session.headers["User-Agent"] = "coran-mp3-align/1.0 (+https://tirgani.github.io/quran-mp3/)"

    print("Chargement du texte de référence (alquran.cloud, une fois pour toutes)...")
    all_texts = load_all_surah_texts(session)

    # Sourates courtes d'abord : résultats utiles rapidement, les plus longues
    # (Al-Baqara, Al-i-Imran...) qui dominent le temps total passent en dernier.
    surahs.sort(key=lambda n: sum(len(t) for t in all_texts[str(n)]))

    print("Chargement du modèle d'alignement (premier lancement : télécharge ~1.2 Go)...")
    import ctc_forced_aligner as cfa
    aligner = cfa.AlignmentSingleton()

    # Sourates en boucle externe (plutôt que récitateur) : après un run limité en temps, tous les
    # récitateurs ont progressé un peu, au lieu que le premier seul soit fini pendant que les autres
    # attendent. Chaque item reste indépendant et resumable (skip si déjà présent).
    work = [(reciter, n) for n in surahs for reciter in chosen]
    total = len(work)
    done = ok = skipped = failed = 0
    t_start = time.time()
    stopped_early = False
    for reciter, n in work:
        if args.time_budget_min and (time.time() - t_start) / 60 >= args.time_budget_min:
            stopped_early = True
            break
        done += 1
        elapsed = time.time() - t_start
        rate = done / elapsed if elapsed > 0 else 0
        eta_min = (total - done) / rate / 60 if rate > 0 else 0
        print(
            f"\r[{done}/{total}] {reciter['id']} sourate {n:3d}  "
            f"(ok={ok} skip={skipped} fail={failed}, ETA {eta_min:.0f} min)      ",
            end="",
            flush=True,
        )
        try:
            status = process_surah(
                aligner, reciter, n, all_texts[str(n)], out_dir, session, args.overwrite, args.keep_audio
            )
            if status == "ok":
                ok += 1
            else:
                skipped += 1
        except Exception as e:
            failed += 1
            with open(FAIL_LOG, "a", encoding="utf-8") as f:
                f.write(f"{reciter['id']}\t{n}\t{e}\n")
                f.write(traceback.format_exc() + "\n")
            log.info(f"échec {reciter['id']} sourate {n}: {e}")

    print()
    suffix = " (arrêt sur budget de temps, reprendra au prochain lancement)" if stopped_early else ""
    print(f"Terminé{suffix} : {ok} générés, {skipped} déjà présents, {failed} échecs.")
    if failed:
        print(f"Détails des échecs : {FAIL_LOG}")


if __name__ == "__main__":
    main()
