import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface IconProps {
  name: string;
  size?: number;
  color: string;
}

export function isIconName(name: string): name is IconName {
  return name in MaterialCommunityIcons.glyphMap;
}

/** Decorative icon (hidden from screen readers — label the parent instead). */
export function Icon({ name, size = 24, color }: IconProps) {
  return (
    <MaterialCommunityIcons
      name={isIconName(name) ? name : 'help-circle-outline'}
      size={size}
      color={color}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
