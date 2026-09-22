import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';

import { getLanguage, t } from '@/i18n/i18n';

import privacyEn from './privacy.en.json';
import privacyPt from './privacy.pt.json';

/** Privacy policy, available offline. The same text is published at /privacidade.html. */
export function PrivacyScreen() {
  const privacy = getLanguage() === 'en' ? privacyEn : privacyPt;
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <AppText tone="muted">{t('Atualizada em {date}', { date: privacy.updatedAt })}</AppText>
      {privacy.sections.map((section) => (
        <View key={section.title} style={styles.section}>
          <AppText variant="heading" accessibilityRole="header">
            {section.title}
          </AppText>
          {section.paragraphs.map((paragraph) => (
            <AppText key={paragraph}>{paragraph}</AppText>
          ))}
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
