import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTheme } from '@/theme/ThemeProvider';
import { MAX_CONTENT_WIDTH, spacing } from '@/theme/tokens';

interface ScreenProps {
  children: ReactNode;
  /** Wrap content in a ScrollView (default true). */
  scroll?: boolean;
  /** Safe-area edges to pad. Screens under a stack header only need the bottom. */
  edges?: Edge[];
}

/** Paper grain, light theme only: it would read as noise on dark OLED screens. */
const PAPER = require('../../assets/images/paper-texture.png') as number;

/** Screen container: themed background, safe area and a centered max-width column. */
export function Screen({ children, scroll = true, edges = ['top', 'left', 'right'] }: ScreenProps) {
  const { colors, scheme } = useTheme();
  const content = <View style={styles.column}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }]}>
      {scheme === 'light' ? (
        <Image
          source={PAPER}
          resizeMode="repeat"
          style={styles.paper}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        />
      ) : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  paper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.7,
  },
  scrollContent: { flexGrow: 1 },
  column: {
    flex: 1,
    width: '100%',
    maxWidth: MAX_CONTENT_WIDTH,
    alignSelf: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
});
