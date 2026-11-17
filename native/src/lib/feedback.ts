import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Les avis et rapports d'erreur sont envoyés à un formulaire Formspree, qui les transfère par
// e-mail à l'éditeur. Aucun numéro ni adresse personnelle n'apparaît dans l'application.
// Identifiant du formulaire : formspree.io > le formulaire > « Integration » (https://formspree.io/f/XXXXXXXX).
export const FORMSPREE_ID = 'REMPLACER_PAR_ID';

export type FeedbackFields = {
  subject: string;
  message: string;
  email?: string;
  rating?: number;
  type?: string;
  crash?: string;
};

/** Envoie l'avis. Renvoie true si le serveur l'a bien reçu. */
export async function sendFeedback(f: FeedbackFields): Promise<boolean> {
  try {
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        _subject: f.subject,
        message: f.message,
        ...(f.email ? { email: f.email } : {}),
        ...(f.rating ? { note: `${f.rating} / 5` } : {}),
        ...(f.type ? { type: f.type } : {}),
        ...(f.crash ? { rapport: f.crash } : {}),
        appareil: `${Platform.OS} ${Platform.Version} · v${Constants.expoConfig?.version ?? ''}`,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
