import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { formatNumber, parseDecimal } from '@/core/format';
import type { Tracking, TrackingType } from '@/core/habits/types';
import { UNIT_MAX_LENGTH } from '@/core/habits/validation';
import { spacing } from '@/theme/tokens';
import { SegmentedControl } from '@/ui/SegmentedControl';
import { TextField } from '@/ui/TextField';

interface TrackingPickerProps {
  value: Tracking;
  onChange: (tracking: Tracking) => void;
  errors: { tracking?: string; unit?: string; step?: string };
}

const TYPE_OPTIONS = [
  { value: 'boolean', label: 'Sim/Não', icon: 'check' },
  { value: 'quantity', label: 'Quantidade', icon: 'counter' },
  { value: 'timer', label: 'Timer', icon: 'timer-outline' },
] as const;

interface Texts {
  target: string;
  unit: string;
  step: string;
  minutes: string;
}

function textsFrom(tracking: Tracking): Texts {
  return {
    target: tracking.type === 'quantity' ? formatNumber(tracking.target) : '2',
    unit: tracking.type === 'quantity' ? tracking.unit : 'L',
    step: tracking.type === 'quantity' ? formatNumber(tracking.step) : '0,25',
    minutes: tracking.type === 'timer' ? formatNumber(tracking.targetSeconds / 60) : '30',
  };
}

function trackingFrom(type: TrackingType, texts: Texts): Tracking {
  switch (type) {
    case 'boolean':
      return { type };
    case 'quantity':
      return {
        type,
        target: parseDecimal(texts.target),
        unit: texts.unit,
        step: parseDecimal(texts.step),
      };
    case 'timer':
      return { type, targetSeconds: Math.round(parseDecimal(texts.minutes) * 60) };
  }
}

export function TrackingPicker({ value, onChange, errors }: TrackingPickerProps) {
  // Raw text is kept locally so partial input like "2," is not lost while typing.
  const [texts, setTexts] = useState(() => textsFrom(value));

  const updateText = (key: keyof Texts, text: string) => {
    const next = { ...texts, [key]: text };
    setTexts(next);
    onChange(trackingFrom(value.type, next));
  };

  return (
    <View style={styles.container}>
      <SegmentedControl<TrackingType>
        label="Acompanhamento"
        options={TYPE_OPTIONS}
        value={value.type}
        onChange={(type) => onChange(trackingFrom(type, texts))}
      />

      {value.type === 'quantity' ? (
        <View style={styles.params}>
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField
                label="Meta diária"
                value={texts.target}
                onChangeText={(text) => updateText('target', text)}
                keyboardType="decimal-pad"
                placeholder="2"
                error={errors.tracking}
              />
            </View>
            <View style={styles.flex}>
              <TextField
                label="Unidade"
                value={texts.unit}
                onChangeText={(text) => updateText('unit', text)}
                placeholder="L, páginas…"
                maxLength={UNIT_MAX_LENGTH}
                error={errors.unit}
              />
            </View>
          </View>
          <TextField
            label="Incremento dos botões + / −"
            value={texts.step}
            onChangeText={(text) => updateText('step', text)}
            keyboardType="decimal-pad"
            placeholder="1"
            error={errors.step}
          />
        </View>
      ) : null}

      {value.type === 'timer' ? (
        <TextField
          label="Meta diária (minutos)"
          value={texts.minutes}
          onChangeText={(text) => updateText('minutes', text)}
          keyboardType="decimal-pad"
          placeholder="30"
          error={errors.tracking}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  params: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
