// react-native-web's Alert is a no-op, so the web uses the browser dialogs.

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
}

export function confirm({ title, message }: ConfirmOptions): Promise<boolean> {
  return Promise.resolve(window.confirm(`${title}\n\n${message}`));
}

export function showError(message: string, error?: unknown): void {
  if (error !== undefined) console.error(message, error);
  window.alert(`Algo deu errado\n\n${message}`);
}
