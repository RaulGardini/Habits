import { Alert } from 'react-native';
import { hapticError, hapticWarning } from '@/lib/haptics';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
}

/** Cross-platform confirmation dialog. Resolves `true` when the user confirms. */
export function confirm({
  title,
  message,
  confirmLabel,
  destructive,
}: ConfirmOptions): Promise<boolean> {
  if (destructive) hapticWarning();
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
        {
          text: confirmLabel,
          style: destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

export function showError(message: string, error?: unknown): void {
  hapticError();
  if (error !== undefined) console.error(message, error);
  Alert.alert('Algo deu errado', message);
}
