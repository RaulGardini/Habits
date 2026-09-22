import { AppText } from './AppText';
import { EmptyState } from './EmptyState';
import { Screen } from './Screen';
import { t } from '@/i18n/i18n';

interface ComingSoonScreenProps {
  title: string;
  icon: string;
  description: string;
}

export function ComingSoonScreen({ title, icon, description }: ComingSoonScreenProps) {
  return (
    <Screen>
      <AppText variant="title" accessibilityRole="header">
        {title}
      </AppText>
      <EmptyState icon={icon} title={t('Em breve')} description={description} />
    </Screen>
  );
}
