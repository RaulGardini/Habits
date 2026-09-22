import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme/tokens';
import { AppText } from '@/ui/AppText';
import { Screen } from '@/ui/Screen';

import privacy from './privacy.json';

/** Privacy policy, available offline. The same text is published at /privacidade.html. */
export function PrivacyScreen() {
  return (
    <Screen edges={['bottom', 'left', 'right']}>
      <AppText tone="muted">Atualizada em {privacy.updatedAt}</AppText>
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
