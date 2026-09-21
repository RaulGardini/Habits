import type { IconName } from '@/ui/Icon';

export interface HabitIconOption {
  name: IconName;
  /** pt-BR label for screen readers. */
  label: string;
}

export const DEFAULT_HABIT_ICON: IconName = 'star-outline';

/** Curated MaterialCommunityIcons for habits. */
export const HABIT_ICONS: readonly HabitIconOption[] = [
  { name: 'star-outline', label: 'Estrela' },
  { name: 'check-circle-outline', label: 'Check' },
  { name: 'cup-water', label: 'Água' },
  { name: 'food-apple-outline', label: 'Fruta' },
  { name: 'silverware-fork-knife', label: 'Refeição' },
  { name: 'coffee-outline', label: 'Café' },
  { name: 'pill', label: 'Remédio' },
  { name: 'tooth-outline', label: 'Dentes' },
  { name: 'shower-head', label: 'Banho' },
  { name: 'bed-outline', label: 'Dormir' },
  { name: 'alarm', label: 'Despertar' },
  { name: 'run', label: 'Corrida' },
  { name: 'walk', label: 'Caminhada' },
  { name: 'bike', label: 'Bicicleta' },
  { name: 'dumbbell', label: 'Musculação' },
  { name: 'yoga', label: 'Yoga' },
  { name: 'swim', label: 'Natação' },
  { name: 'meditation', label: 'Meditação' },
  { name: 'heart-pulse', label: 'Saúde' },
  { name: 'scale-bathroom', label: 'Peso' },
  { name: 'book-open-variant', label: 'Leitura' },
  { name: 'school-outline', label: 'Estudo' },
  { name: 'translate', label: 'Idiomas' },
  { name: 'pencil-outline', label: 'Escrita' },
  { name: 'notebook-outline', label: 'Diário' },
  { name: 'laptop', label: 'Computador' },
  { name: 'code-tags', label: 'Programação' },
  { name: 'briefcase-outline', label: 'Trabalho' },
  { name: 'music-note', label: 'Música' },
  { name: 'guitar-acoustic', label: 'Violão' },
  { name: 'palette-outline', label: 'Arte' },
  { name: 'camera-outline', label: 'Fotografia' },
  { name: 'broom', label: 'Limpeza' },
  { name: 'washing-machine', label: 'Lavar roupa' },
  { name: 'sprout-outline', label: 'Plantas' },
  { name: 'dog-side', label: 'Pet' },
  { name: 'cash', label: 'Dinheiro' },
  { name: 'piggy-bank-outline', label: 'Economizar' },
  { name: 'phone-off', label: 'Sem celular' },
  { name: 'smoking-off', label: 'Sem cigarro' },
  { name: 'glass-cocktail-off', label: 'Sem álcool' },
  { name: 'account-group-outline', label: 'Família e amigos' },
  { name: 'phone-outline', label: 'Ligar' },
  { name: 'hand-heart-outline', label: 'Gratidão' },
  { name: 'weather-sunny', label: 'Sol' },
  { name: 'leaf', label: 'Natureza' },
  { name: 'target', label: 'Meta' },
  { name: 'lightning-bolt-outline', label: 'Energia' },
];
