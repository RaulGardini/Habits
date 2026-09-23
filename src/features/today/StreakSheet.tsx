import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatShortDate } from '@/core/dates/localDate';
import {
  daysToNextTier,
  flameTierIndex,
  FLAME_TIERS,
  tierProgress,
  type PerfectStreak,
} from '@/core/habits/perfectStreak';
import { t } from '@/i18n/i18n';
import { flameColors } from '@/theme/flameColors';
import { useTheme } from '@/theme/ThemeProvider';
import { MAX_CONTENT_WIDTH, radius, spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Button } from '@/ui/Button';
import { Flame } from '@/ui/Flame';

const STEP_WIDTH = 74;

/** The whole flame ladder, with a bar running through every tier and a marker on the current one. */
export function StreakSheet({
  streak,
  visible,
  onClose,
}: {
  streak: PerfectStreak;
  visible: boolean;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const tier = flameTierIndex(streak.current);
  const next = daysToNextTier(streak.current);
  const current = flameColors(tier);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('Fechar')}
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: spacing.xl + insets.bottom,
              boxShadow: `0 -8px 32px ${colors.shadow}33`,
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />

          <View style={styles.header}>
            <Flame days={streak.current} size={64} dimmed={streak.current === 0} />
            <View style={styles.flex}>
              <AppText variant="title" accessibilityRole="header">
                {streak.current === 0
                  ? t('Sem sequência ainda')
                  : streak.current === 1
                    ? t('1 dia perfeito')
                    : t('{count} dias perfeitos', { count: streak.current })}
              </AppText>
              <AppText tone="muted">
                {t('Chama {name}', { name: t(current.label) })}
                {streak.startedOn
                  ? ` · ${t('desde {date}', { date: formatShortDate(streak.startedOn) })}`
                  : ''}
              </AppText>
            </View>
          </View>

          <AppText tone="muted">
            {!next
              ? t('Você chegou à última chama. Impressionante!')
              : next.remaining === 1
                ? t('Falta 1 dia para a chama {name}.', {
                    name: t(flameColors(flameTierIndex(next.threshold)).label),
                  })
                : t('Faltam {count} dias para a chama {name}.', {
                    count: next.remaining,
                    name: t(flameColors(flameTierIndex(next.threshold)).label),
                  })}
          </AppText>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.ladder}
            accessibilityLabel={t('Trilha das chamas')}
          >
            <View
              style={[
                styles.track,
                { backgroundColor: colors.surfaceMuted, width: STEP_WIDTH * FLAME_TIERS.length },
              ]}
              accessibilityElementsHidden
            />
            <View
              style={[
                styles.track,
                styles.trackFill,
                {
                  backgroundColor: colors.primary,
                  width: filledWidth(streak.current),
                },
              ]}
              accessibilityElementsHidden
            />
            {FLAME_TIERS.map((threshold, index) => {
              const reached = streak.current >= threshold;
              const isCurrent = index === tier;
              return (
                <View key={threshold} style={styles.step}>
                  <Flame
                    days={threshold}
                    size={isCurrent ? 40 : 30}
                    animated={reached}
                    dimmed={!reached}
                  />
                  <AppText
                    variant="label"
                    tone={isCurrent ? colors.accent : reached ? 'default' : 'muted'}
                  >
                    {threshold === 0 ? t('início') : String(threshold)}
                  </AppText>
                  {isCurrent ? (
                    <View style={[styles.marker, { backgroundColor: colors.primary }]}>
                      <AppText variant="caption" tone={colors.onPrimary}>
                        {t('você')}
                      </AppText>
                    </View>
                  ) : (
                    <View style={styles.markerSpacer} />
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.stats}>
            <Stat label={t('Sequência atual')} value={String(streak.current)} />
            <Stat label={t('Recorde')} value={String(streak.longest)} />
          </View>

          <AppText variant="caption" tone="muted">
            {t('Um dia perfeito é um dia em que você concluiu todos os hábitos programados.')}
          </AppText>

          <Button variant="ghost" label={t('Fechar')} onPress={onClose} />
        </View>
      </View>
    </Modal>
  );
}

/** Width of the filled bar: whole steps plus the progress inside the current tier. */
function filledWidth(days: number): number {
  const index = flameTierIndex(days);
  return STEP_WIDTH / 2 + (index + tierProgress(days)) * STEP_WIDTH;
}

function Stat({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surfaceMuted }]}>
      <AppText variant="title">{value}</AppText>
      <AppText variant="caption" tone="muted">
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    borderTopLeftRadius: radius.lg + 6,
    borderTopRightRadius: radius.lg + 6,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.lg,
  },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  ladder: { alignItems: 'flex-end', paddingVertical: spacing.sm },
  track: { position: 'absolute', left: 0, bottom: 34, height: 6, borderRadius: 3 },
  trackFill: {},
  step: { width: STEP_WIDTH, alignItems: 'center', gap: spacing.xs },
  marker: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 1,
    borderRadius: radius.full,
    marginTop: 2,
  },
  markerSpacer: { height: 20 },
  stats: { flexDirection: 'row', gap: spacing.md },
  stat: { flex: 1, alignItems: 'center', padding: spacing.md, borderRadius: radius.lg, gap: 2 },
});
