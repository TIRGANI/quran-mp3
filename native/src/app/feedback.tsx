import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Linking, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { Button, Card, Chip, Row, Screen, Txt } from '@/components/ui';
import { useIsRTL, useT } from '@/i18n';
import { clearCrash, lastCrash } from '@/lib/crash';
import { toast } from '@/lib/toast';
import { FONTS, useColors } from '@/theme/colors';

// Numéro déjà public sur wirdan.app (pied de page) et dans la politique de confidentialité
const WHATSAPP = '212602834831';
type Kind = 'bug' | 'idea' | 'thanks' | 'other';

/** Avis de l'utilisateur, envoyé par WhatsApp (aucun serveur, rien n'est envoyé sans son accord). */
export default function FeedbackScreen() {
  const c = useColors();
  const t = useT();
  const rtl = useIsRTL();
  const [rating, setRating] = useState(0);
  const [kind, setKind] = useState<Kind>('idea');
  const [message, setMessage] = useState('');
  const [crash] = useState(lastCrash);
  const [attach, setAttach] = useState(true);

  const send = () => {
    if (!message.trim() && !rating) return toast(t.feedbackEmpty);
    const label = { bug: t.feedbackBug, idea: t.feedbackIdea, thanks: t.feedbackThanks, other: t.feedbackOther }[kind];
    const text = [
      `Wirdan — ${t.feedback}`,
      rating ? `${t.feedbackRating} : ${'★'.repeat(rating)}${'☆'.repeat(5 - rating)}` : '',
      `${t.feedbackType} : ${label}`,
      message.trim(),
      `— ${Platform.OS} ${Platform.Version} · v${Constants.expoConfig?.version ?? ''}`,
      crash && attach ? `\n[${t.crashReportTitle} · ${crash.time}]\n${crash.message}\n${crash.stack}` : '',
    ]
      .filter(Boolean)
      .join('\n');
    Linking.openURL(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`)
      .then(() => {
        if (crash && attach) clearCrash();
      })
      .catch(() => toast(t.playbackError));
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }} keyboardShouldPersistTaps="handled">
        <Row style={{ justifyContent: 'space-between' }}>
          <Txt variant="title" style={{ color: c.primary }}>
            {t.feedback}
          </Txt>
          <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel={t.close}>
            <Ionicons name="close" size={26} color={c.text} />
          </Pressable>
        </Row>
        <Txt variant="small">{t.feedbackSubtitle}</Txt>

        <Card style={{ gap: 10 }}>
          <Txt variant="label">{t.feedbackRating}</Txt>
          <Row gap={6} style={{ direction: 'ltr' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <Pressable key={n} onPress={() => setRating(n)} hitSlop={6} accessibilityLabel={`${n} / 5`} accessibilityState={{ selected: rating === n }}>
                <Ionicons name={n <= rating ? 'star' : 'star-outline'} size={34} color={c.accent} />
              </Pressable>
            ))}
          </Row>
          <Txt variant="label">{t.feedbackType}</Txt>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {(
              [
                ['bug', t.feedbackBug],
                ['idea', t.feedbackIdea],
                ['thanks', t.feedbackThanks],
                ['other', t.feedbackOther],
              ] as [Kind, string][]
            ).map(([k, label]) => (
              <Chip key={k} label={label} on={kind === k} onPress={() => setKind(k)} />
            ))}
          </View>
          <Txt variant="label">{t.feedbackMessage}</Txt>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={t.feedbackPlaceholder}
            placeholderTextColor={c.muted}
            multiline
            textAlignVertical="top"
            style={{ minHeight: 130, borderWidth: 1, borderColor: c.line, borderRadius: 14, padding: 12, color: c.text, fontFamily: FONTS.ui, fontSize: 15, textAlign: rtl ? 'right' : 'left', backgroundColor: c.background }}
          />
        </Card>

        {crash && (
          <Pressable onPress={() => setAttach(!attach)} accessibilityRole="checkbox" accessibilityState={{ checked: attach }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={attach ? 'checkbox' : 'square-outline'} size={22} color={c.accentStrong} />
            <Txt variant="label" weight="regular" style={{ flex: 1 }}>
              {t.feedbackAttachCrash}
            </Txt>
          </Pressable>
        )}
        <Button label={t.feedbackSend} icon={<Ionicons name="logo-whatsapp" size={18} color="#fff" />} onPress={send} />
        <Txt variant="small" style={{ textAlign: 'center' }}>
          {t.feedbackNote}
        </Txt>
      </ScrollView>
    </Screen>
  );
}
