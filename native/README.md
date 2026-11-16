# Wirdan — application iPhone et Android

Application native (React Native + Expo SDK 58) : écoute du Coran avec 69 récitateurs, lecture du
texte avec suivi de la progression et tafsir, mode Hifdh (mémorisation verset par verset), adhkar
de Hisn al-Muslim avec compteur, rappels par notification, écoute hors connexion. Même contenu que le site
[wirdan.app](https://wirdan.app) (dossier parent).

## Tester sur ton téléphone (sans compte Apple, sans Xcode)

1. Installer **Expo Go** sur l'iPhone (App Store) ou Android (Play Store).
2. Dans ce dossier :
   ```bash
   npm install
   npx expo start
   ```
3. Scanner le QR code affiché (appareil photo sur iPhone, Expo Go sur Android).

Les modifications du code apparaissent aussitôt sur le téléphone.
Limite d'Expo Go : la lecture en arrière-plan et les commandes de l'écran verrouillé ne sont
complètes que dans une vraie version de l'app (voir ci-dessous).

## Construire l'app (App Store / Play Store)

Les builds se font dans le cloud avec EAS : **pas besoin de Xcode**.

```bash
npx eas-cli@latest login                                   # compte Expo (gratuit)
npx eas-cli@latest build --platform android --profile preview     # APK à installer directement
npx eas-cli@latest build --platform ios --profile production      # demande le compte Apple Developer
npx eas-cli@latest submit --platform ios                          # envoi sur App Store Connect
```

- iOS : identifiant `com.tirgani.wirdan`.
- Android : identifiant `com.tirgani.coranmp3`, le même que l'ancienne app Capacitor, pour que
  l'app remplace l'ancienne chez les utilisateurs. Pour cela, le build doit être signé avec la clé
  existante (`~/Documents/coranmp3-signature/`) : l'importer dans EAS au premier build
  (`eas credentials`).

## Organisation du code

```
src/
  app/                 Écrans (Expo Router : un fichier = un écran)
    (tabs)/            Onglets : Écouter (index), Lire (read), Hifdh, Adhkar, Réglages (settings)
    reader/[surah].tsx Page de lecture d'une sourate (+ tafsir d'un verset)
    adhkar/[id].tsx    Un chapitre de Hisn al-Muslim, avec compteur
    player.tsx         Lecteur audio complet
    reciters.tsx       Choix du récitateur
  audio/               Lecteur unique (player.ts), mode Hifdh (hifdh.ts), téléchargements (downloads.ts)
  notifications/       Rappels locaux : wird, adhkar du matin / soir / sommeil, Al-Kahf le vendredi
  stores/              État persistant : réglages, progression de lecture (Zustand + SQLite)
  data/                Sourates et récitateurs — générés depuis ../index.html
  lib/                 Texte du Coran, stockage, recherche, messages
  i18n/                Textes de l'interface en arabe et en français
  theme/               Couleurs Wirdan (clair / sombre / sépia) et polices
  components/          Composants d'interface réutilisables
assets/
  data/quran-text.json Texte Uthmani complet (lecture hors ligne)
  data/adhkar.json     Hisn al-Muslim (132 chapitres), généré par scripts/fetch-adhkar.mjs
  reciters/            Photos des récitateurs
```

Après un changement de la liste des récitateurs dans le site, regénérer les données :

```bash
node scripts/extract-data.mjs && cp ../qurra/*.webp assets/reciters/
```

## Vérifications

```bash
npx tsc --noEmit   # types
npx eslint src     # règles de code
npx expo-doctor    # configuration Expo
```
