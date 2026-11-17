import Constants from 'expo-constants';
import { Platform } from 'react-native';

// Les avis et rapports d'erreur sont envoyés à FormSubmit, qui les transfère par e-mail à
// l'éditeur. L'identifiant aléatoire remplace l'adresse : aucune adresse personnelle n'apparaît
// dans l'application. Le formulaire est activé pour le domaine wirdan.app (d'où le Referer).
export const FORMSUBMIT_ID = '99eaf9bf89bed72bd6f3bb3e959e77f6';

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
    const res = await fetch(`https://formsubmit.co/ajax/${FORMSUBMIT_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', Referer: 'https://wirdan.app/' },
      body: JSON.stringify({
        _subject: f.subject,
        _template: 'table',
        message: f.message,
        ...(f.email ? { email: f.email } : {}),
        ...(f.rating ? { note: `${f.rating} / 5` } : {}),
        ...(f.type ? { type: f.type } : {}),
        ...(f.crash ? { rapport: f.crash } : {}),
        appareil: `${Platform.OS} ${Platform.Version} · v${Constants.expoConfig?.version ?? ''}`,
      }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { success?: string | boolean };
    return String(json.success) === 'true';
  } catch {
    return false;
  }
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
