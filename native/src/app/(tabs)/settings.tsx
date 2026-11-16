import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Switch, View } from 'react-native';

import { CAN_DOWNLOAD, deleteAll, usedBytes, useDownloads } from '@/audio/downloads';
import { setRate } from '@/audio/player';
import { Tip } from '@/components/Tip';
import { Button, Card, Row, Screen, Segmented, Txt } from '@/components/ui';
import { useT } from '@/i18n';
import { toast } from '@/lib/toast';
import { CAN_NOTIFY, ensurePermission } from '@/notifications/reminders';
import { useSettings, type ReminderKey } from '@/stores/settings';
import { startTour } from '@/tour/steps';
import { useColors } from '@/theme/colors';

export default function SettingsScreen() {
  const c = useColors();
  const t = useT();
  const { lang, theme, rate, autoNext, repeat, autoSave, reminders, set } = useSettings();
  const done = useDownloads(s => s.done);
  const [armed, setArmed] = useState(false);
  const count = Object.keys(done).length;
  const mb = usedBytes(done) / 1024 / 1024;

  const toggle = (label: string, value: boolean, onChange: (v: boolean) => void) => (
    <Row style={{ justifyContent: 'space-between', paddingVertical: 6 }}>
      <Txt style={{ flex: 1 }}>{label}</Txt>
      <Switch value={value} onValueChange={onChange} trackColor={{ true: c.accentStrong, false: c.line }} thumbColor="#fff" />
    </Row>
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 30 }}>
        <Txt variant="title" style={{ color: c.primary }}>
          {t.tabSettings}
        </Txt>
        <Tip id="settings" />

        <Card style={{ gap: 12 }}>
          <Txt variant="label" color={c.accentStrong}>
            {t.language}
          </Txt>
          <Segmented
            options={[
              ['ar', 'العربية'],
              ['fr', 'Français'],
            ]}
            value={lang}
            onChange={v => set({ lang: v })}
          />
          <Txt variant="label" color={c.accentStrong}>
            {t.appearance}
          </Txt>
          <Segmented
            options={[
              ['system', t.themeSystem],
              ['light', t.themeLight],
              ['dark', t.themeNight],
            ]}
            value={theme}
            onChange={v => set({ theme: v })}
          />
        </Card>

        <Card style={{ gap: 6 }}>
          <Txt variant="label" color={c.accentStrong}>
            {t.playback}
          </Txt>
          <Txt variant="small">{t.speed}</Txt>
          <Segmented
            options={[
              [0.75, '0.75×'],
              [1, '1×'],
              [1.25, '1.25×'],
              [1.5, '1.5×'],
            ]}
            value={rate}
            onChange={setRate}
          />
          {toggle(t.autoNext, autoNext, v => set({ autoNext: v }))}
          {toggle(t.repeat, repeat, v => set({ repeat: v }))}
        </Card>

        {CAN_NOTIFY && (
          <Card style={{ gap: 4 }}>
            <Txt variant="label" color={c.accentStrong}>
              {t.reminders}
            </Txt>
            <Txt variant="small">{t.remindersNote}</Txt>
            {(
              [
                ['morning', t.reminderMorning],
                ['evening', t.reminderEvening],
                ['sleep', t.reminderSleep],
                ['wird', t.reminderWird],
                ['kahf', t.reminderKahf],
              ] as [ReminderKey, string][]
            ).map(([key, label]) => (
              <ReminderRow
                key={key}
                label={label}
                value={reminders[key]}
                onChange={async next => {
                  if (next.on && !reminders[key].on && !(await ensurePermission())) return toast(t.notifDenied);
                  set({ reminders: { ...useSettings.getState().reminders, [key]: next } });
                }}
              />
            ))}
          </Card>
        )}

        {CAN_DOWNLOAD && (
          <Card style={{ gap: 8 }}>
            <Txt variant="label" color={c.accentStrong}>
              {t.offline}
            </Txt>
            {toggle(t.autoSave, autoSave, v => set({ autoSave: v }))}
            <Txt variant="small">{t.storageUsed(t.mb(mb), count)}</Txt>
            {count > 0 && (
              <Button
                label={armed ? t.confirmDeleteAll : t.deleteAll}
                kind="danger"
                style={armed ? { backgroundColor: c.danger } : undefined}
                onPress={() => {
                  if (!armed) return setArmed(true);
                  deleteAll();
                  setArmed(false);
                }}
              />
            )}
          </Card>
        )}

        <Card style={{ gap: 10 }}>
          <Txt variant="label" color={c.accentStrong}>
            {t.help}
          </Txt>
          <Row gap={8} style={{ flexWrap: 'wrap' }}>
            <Button label={t.tourReplay} kind="ghost" onPress={startTour} />
            <Button
              label={t.replayTips}
              kind="ghost"
              onPress={() => {
                set({ seenTips: {} });
                toast(t.tipsReset);
              }}
            />
          </Row>
        </Card>

        <Card style={{ gap: 8 }}>
          <Txt variant="label" color={c.accentStrong}>
            {t.about}
          </Txt>
          <Txt>{t.freeNote}</Txt>
          <View style={{ height: 1, backgroundColor: c.line }} />
          <Txt variant="small">{t.copyright}</Txt>
        </Card>
      </ScrollView>
    </Screen>
  );
}

/** Un rappel : interrupteur + heure réglable par pas de 15 minutes. */
function ReminderRow({ label, value, onChange }: { label: string; value: { on: boolean; hour: number; minute: number }; onChange: (v: { on: boolean; hour: number; minute: number }) => void }) {
  const c = useColors();
  const t = useT();
  const shift = (delta: number) => {
    const total = (value.hour * 60 + value.minute + delta + 24 * 60) % (24 * 60);
    onChange({ ...value, hour: Math.floor(total / 60), minute: total % 60 });
  };
  const time = `${String(value.hour).padStart(2, '0')}:${String(value.minute).padStart(2, '0')}`;
  return (
    <View style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: c.line, gap: 6 }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Txt style={{ flex: 1 }}>{label}</Txt>
        <Switch value={value.on} onValueChange={on => onChange({ ...value, on })} trackColor={{ true: c.accentStrong, false: c.line }} thumbColor="#fff" />
      </Row>
      {value.on && (
        <Row gap={10} style={{ direction: 'ltr', alignSelf: 'flex-start' }}>
          <Pressable onPress={() => shift(-15)} hitSlop={8} accessibilityLabel={t.earlier} style={{ padding: 6, borderRadius: 18, borderWidth: 1, borderColor: c.line }}>
            <Ionicons name="remove" size={18} color={c.text} />
          </Pressable>
          <Txt variant="h2" style={{ minWidth: 60, textAlign: 'center' }}>
            {time}
          </Txt>
          <Pressable onPress={() => shift(15)} hitSlop={8} accessibilityLabel={t.later} style={{ padding: 6, borderRadius: 18, borderWidth: 1, borderColor: c.line }}>
            <Ionicons name="add" size={18} color={c.text} />
          </Pressable>
        </Row>
      )}
    </View>
  );
}
