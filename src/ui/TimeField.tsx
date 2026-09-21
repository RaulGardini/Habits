import { normalizeTimeInput } from '@/core/format';

import { TextField } from './TextField';

interface TimeFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}

/** Cross-platform `HH:mm` input (native time pickers do not exist on web). */
export function TimeField({
  label,
  value,
  onChange,
  error,
  placeholder = '08:00',
}: TimeFieldProps) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(text) => onChange(normalizeTimeInput(text))}
      onBlur={() => {
        // Pad a single-digit hour on blur: "9:30" → "09:30".
        if (/^\d:\d{2}$/.test(value)) onChange(`0${value}`);
      }}
      keyboardType="number-pad"
      placeholder={placeholder}
      maxLength={5}
      error={error}
    />
  );
}
