import type { IconName } from '@/ui/Icon';

export interface HabitIconOption {
  name: IconName;
  /** pt-BR label for screen readers. */
  label: string;
}

export interface HabitIconGroup {
  /** pt-BR group title shown in the picker. */
  title: string;
  icons: readonly HabitIconOption[];
}

export const DEFAULT_HABIT_ICON: IconName = 'star-outline';

/** Curated MaterialCommunityIcons for habits, grouped for the picker. */
export const HABIT_ICON_GROUPS: readonly HabitIconGroup[] = [
  {
    title: 'Geral',
    icons: [
      { name: 'star-outline', label: 'Estrela' },
      { name: 'check-circle-outline', label: 'Check' },
      { name: 'target', label: 'Meta' },
      { name: 'trophy-outline', label: 'Troféu' },
      { name: 'flag-checkered', label: 'Chegada' },
      { name: 'rocket-launch-outline', label: 'Foguete' },
      { name: 'fire', label: 'Foco' },
      { name: 'lightning-bolt-outline', label: 'Energia' },
      { name: 'infinity', label: 'Sempre' },
      { name: 'clock-outline', label: 'Relógio' },
      { name: 'timer-outline', label: 'Cronômetro' },
      { name: 'bell-ring-outline', label: 'Lembrete' },
    ],
  },
  {
    title: 'Saúde e cuidados',
    icons: [
      { name: 'cup-water', label: 'Água' },
      { name: 'pill', label: 'Remédio' },
      { name: 'medication-outline', label: 'Vitaminas' },
      { name: 'heart-pulse', label: 'Saúde' },
      { name: 'scale-bathroom', label: 'Peso' },
      { name: 'thermometer', label: 'Temperatura' },
      { name: 'hospital-box-outline', label: 'Consulta' },
      { name: 'toothbrush', label: 'Escovar os dentes' },
      { name: 'tooth-outline', label: 'Dentes' },
      { name: 'shower-head', label: 'Banho' },
      { name: 'lotion-outline', label: 'Skincare' },
      { name: 'face-man-shimmer-outline', label: 'Autocuidado' },
      { name: 'spa-outline', label: 'Relaxar' },
      { name: 'eye-outline', label: 'Descanso dos olhos' },
      { name: 'bed-outline', label: 'Dormir' },
      { name: 'sleep', label: 'Sono' },
      { name: 'alarm', label: 'Despertar' },
      { name: 'weather-sunset-up', label: 'Acordar cedo' },
    ],
  },
  {
    title: 'Exercício',
    icons: [
      { name: 'run', label: 'Corrida' },
      { name: 'walk', label: 'Caminhada' },
      { name: 'hiking', label: 'Trilha' },
      { name: 'bike', label: 'Bicicleta' },
      { name: 'dumbbell', label: 'Musculação' },
      { name: 'weight-lifter', label: 'Levantamento' },
      { name: 'yoga', label: 'Yoga' },
      { name: 'human-handsup', label: 'Alongamento' },
      { name: 'swim', label: 'Natação' },
      { name: 'jump-rope', label: 'Pular corda' },
      { name: 'karate', label: 'Luta' },
      { name: 'dance-ballroom', label: 'Dança' },
      { name: 'soccer', label: 'Futebol' },
      { name: 'basketball', label: 'Basquete' },
      { name: 'tennis', label: 'Tênis' },
      { name: 'skate', label: 'Skate' },
    ],
  },
  {
    title: 'Alimentação',
    icons: [
      { name: 'food-apple-outline', label: 'Fruta' },
      { name: 'carrot', label: 'Legumes' },
      { name: 'nutrition', label: 'Nutrição' },
      { name: 'silverware-fork-knife', label: 'Refeição' },
      { name: 'egg-outline', label: 'Proteína' },
      { name: 'fish', label: 'Peixe' },
      { name: 'rice', label: 'Arroz' },
      { name: 'bread-slice-outline', label: 'Café da manhã' },
      { name: 'chef-hat', label: 'Cozinhar' },
      { name: 'pot-steam-outline', label: 'Marmita' },
      { name: 'coffee-outline', label: 'Café' },
      { name: 'water-outline', label: 'Hidratação' },
    ],
  },
  {
    title: 'Mente e estudo',
    icons: [
      { name: 'meditation', label: 'Meditação' },
      { name: 'brain', label: 'Mente' },
      { name: 'hands-pray', label: 'Oração' },
      { name: 'hand-heart-outline', label: 'Gratidão' },
      { name: 'emoticon-happy-outline', label: 'Humor' },
      { name: 'book-open-variant', label: 'Leitura' },
      { name: 'book-outline', label: 'Livro' },
      { name: 'school-outline', label: 'Estudo' },
      { name: 'translate', label: 'Idiomas' },
      { name: 'notebook-outline', label: 'Diário' },
      { name: 'pencil-outline', label: 'Escrita' },
      { name: 'lightbulb-on-outline', label: 'Ideias' },
      { name: 'flask-outline', label: 'Ciência' },
      { name: 'calculator-variant-outline', label: 'Matemática' },
      { name: 'newspaper-variant-outline', label: 'Notícias' },
      { name: 'podcast', label: 'Podcast' },
    ],
  },
  {
    title: 'Trabalho e finanças',
    icons: [
      { name: 'briefcase-outline', label: 'Trabalho' },
      { name: 'laptop', label: 'Computador' },
      { name: 'code-tags', label: 'Programação' },
      { name: 'email-outline', label: 'E-mails' },
      { name: 'calendar-check-outline', label: 'Planejar' },
      { name: 'checkbox-marked-outline', label: 'Tarefas' },
      { name: 'chart-line', label: 'Progresso' },
      { name: 'cash', label: 'Dinheiro' },
      { name: 'wallet-outline', label: 'Carteira' },
      { name: 'piggy-bank-outline', label: 'Economizar' },
      { name: 'hand-coin-outline', label: 'Investir' },
      { name: 'chart-pie', label: 'Orçamento' },
    ],
  },
  {
    title: 'Casa e rotina',
    icons: [
      { name: 'home-outline', label: 'Casa' },
      { name: 'broom', label: 'Limpeza' },
      { name: 'vacuum-outline', label: 'Aspirar' },
      { name: 'washing-machine', label: 'Lavar roupa' },
      { name: 'dishwasher', label: 'Louça' },
      { name: 'iron-outline', label: 'Passar roupa' },
      { name: 'bed-king-outline', label: 'Arrumar a cama' },
      { name: 'trash-can-outline', label: 'Lixo' },
      { name: 'recycle', label: 'Reciclar' },
      { name: 'cart-outline', label: 'Mercado' },
      { name: 'sprout-outline', label: 'Plantas' },
      { name: 'watering-can-outline', label: 'Regar' },
      { name: 'dog-side', label: 'Cachorro' },
      { name: 'cat', label: 'Gato' },
      { name: 'paw-outline', label: 'Pet' },
      { name: 'car-outline', label: 'Carro' },
    ],
  },
  {
    title: 'Pessoas',
    icons: [
      { name: 'account-group-outline', label: 'Família e amigos' },
      { name: 'account-heart-outline', label: 'Relacionamento' },
      { name: 'baby-face-outline', label: 'Filhos' },
      { name: 'phone-outline', label: 'Ligar' },
      { name: 'message-text-outline', label: 'Mensagem' },
      { name: 'hand-wave-outline', label: 'Cumprimentar' },
      { name: 'handshake-outline', label: 'Networking' },
      { name: 'heart-outline', label: 'Carinho' },
      { name: 'gift-outline', label: 'Presente' },
      { name: 'church-outline', label: 'Comunidade' },
    ],
  },
  {
    title: 'Lazer e criatividade',
    icons: [
      { name: 'music-note', label: 'Música' },
      { name: 'guitar-acoustic', label: 'Violão' },
      { name: 'piano', label: 'Piano' },
      { name: 'headphones', label: 'Ouvir' },
      { name: 'microphone-outline', label: 'Cantar' },
      { name: 'palette-outline', label: 'Arte' },
      { name: 'brush', label: 'Pintura' },
      { name: 'pencil-ruler', label: 'Desenho' },
      { name: 'camera-outline', label: 'Fotografia' },
      { name: 'puzzle-outline', label: 'Quebra-cabeça' },
      { name: 'chess-knight', label: 'Xadrez' },
      { name: 'gamepad-variant-outline', label: 'Jogos' },
      { name: 'movie-open-outline', label: 'Filmes' },
      { name: 'hammer-wrench', label: 'Consertos' },
      { name: 'leaf', label: 'Natureza' },
      { name: 'tree-outline', label: 'Ar livre' },
      { name: 'weather-sunny', label: 'Sol' },
      { name: 'airplane', label: 'Viagem' },
    ],
  },
  {
    title: 'Parar de…',
    icons: [
      { name: 'phone-off', label: 'Sem celular' },
      { name: 'cellphone-off', label: 'Menos tela' },
      { name: 'television-off', label: 'Sem TV' },
      { name: 'smoking-off', label: 'Sem cigarro' },
      { name: 'cigar-off', label: 'Sem charuto' },
      { name: 'glass-cocktail-off', label: 'Sem álcool' },
      { name: 'coffee-off-outline', label: 'Sem café' },
      { name: 'candy-off-outline', label: 'Sem doce' },
      { name: 'cookie-off-outline', label: 'Sem besteira' },
      { name: 'food-off-outline', label: 'Jejum' },
      { name: 'credit-card-off-outline', label: 'Sem gastos' },
    ],
  },
];

/** Every icon, flat (lookups and tests). */
export const HABIT_ICONS: readonly HabitIconOption[] = HABIT_ICON_GROUPS.flatMap((g) => g.icons);
