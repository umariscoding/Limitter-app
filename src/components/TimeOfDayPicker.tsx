import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { parseHHMM, formatHHMM, nextResetTimestamp } from '../utils/timeWindow';

interface TimeOfDayPickerProps {
  // Canonical "HH:MM" 24h string, e.g. "13:30".
  value: string;
  onChange: (next: string) => void;
  showSeconds?: boolean;
  format?: '12h' | '24h';
  helperText?: string;
  // Optional: show a "Next: today/tomorrow at X" preview line below the picker.
  showNextPreview?: boolean;
}

const HOLD_INITIAL_DELAY_MS = 350;
const HOLD_REPEAT_INTERVAL_MS = 80;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function wrapInRange(value: number, min: number, max: number): number {
  const span = max - min + 1;
  let v = value - min;
  v = ((v % span) + span) % span;
  return v + min;
}

function formatPreview(targetMs: number): string {
  const d = new Date(targetMs);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  if (isTomorrow) return `tomorrow at ${time}`;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function TimeOfDayPicker({
  value,
  onChange,
  showSeconds = false,
  format = '12h',
  helperText,
  showNextPreview = true,
}: TimeOfDayPickerProps) {
  const parsed = parseHHMM(value);
  const [hour24, setHour24] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const [second, setSecond] = useState(0);

  // Re-sync when the parent value changes (e.g., when editing a different policy).
  const lastEmittedRef = useRef<string>(value);
  useEffect(() => {
    if (value === lastEmittedRef.current) return;
    const p = parseHHMM(value);
    setHour24(p.hour);
    setMinute(p.minute);
  }, [value]);

  // Emit canonical HH:MM whenever h/m change (seconds intentionally not part of
  // the wire format — backend cron is minute-resolution).
  useEffect(() => {
    const next = formatHHMM(hour24, minute);
    if (next !== lastEmittedRef.current) {
      lastEmittedRef.current = next;
      onChange(next);
    }
  }, [hour24, minute, onChange]);

  // 12h display state
  const isPM = hour24 >= 12;
  const display12 = useMemo(() => {
    if (hour24 === 0) return 12;
    if (hour24 > 12) return hour24 - 12;
    return hour24;
  }, [hour24]);

  const setHourFrom12h = (h12: number, pm: boolean) => {
    let h24 = h12 % 12;
    if (pm) h24 += 12;
    setHour24(h24);
  };

  const adjustHour = (delta: number) => {
    if (format === '24h') {
      setHour24(prev => wrapInRange(prev + delta, 0, 23));
    } else {
      const next12 = wrapInRange(display12 + delta, 1, 12);
      setHourFrom12h(next12, isPM);
    }
  };

  const adjustMinute = (delta: number) => {
    setMinute(prev => wrapInRange(prev + delta, 0, 59));
  };

  const adjustSecond = (delta: number) => {
    setSecond(prev => wrapInRange(prev + delta, 0, 59));
  };

  const togglePeriod = () => {
    setHourFrom12h(display12, !isPM);
  };

  const previewText = useMemo(
    () => (showNextPreview ? formatPreview(nextResetTimestamp(value)) : ''),
    [value, showNextPreview],
  );

  return (
    <View style={s.wrap}>
      {helperText ? <Text style={s.helper}>{helperText}</Text> : null}

      <View style={s.row}>
        <SteppedField
          label="Hour"
          value={format === '24h' ? pad2(hour24) : pad2(display12)}
          onIncrement={() => adjustHour(1)}
          onDecrement={() => adjustHour(-1)}
        />
        <Text style={s.sep}>:</Text>
        <SteppedField
          label="Min"
          value={pad2(minute)}
          onIncrement={() => adjustMinute(1)}
          onDecrement={() => adjustMinute(-1)}
        />
        {showSeconds ? (
          <>
            <Text style={s.sep}>:</Text>
            <SteppedField
              label="Sec"
              value={pad2(second)}
              onIncrement={() => adjustSecond(1)}
              onDecrement={() => adjustSecond(-1)}
            />
          </>
        ) : null}
        {format === '12h' ? (
          <View style={s.periodWrap}>
            <TouchableOpacity
              style={[s.periodBtn, !isPM && s.periodBtnActive]}
              onPress={() => !isPM ? null : togglePeriod()}
              activeOpacity={0.8}
            >
              <Text style={[s.periodText, !isPM && s.periodTextActive]}>AM</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.periodBtn, isPM && s.periodBtnActive]}
              onPress={() => isPM ? null : togglePeriod()}
              activeOpacity={0.8}
            >
              <Text style={[s.periodText, isPM && s.periodTextActive]}>PM</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      {showNextPreview ? (
        <Text style={s.preview}>
          Next: <Text style={s.previewStrong}>{previewText}</Text>
        </Text>
      ) : null}
    </View>
  );
}

interface SteppedFieldProps {
  label: string;
  value: string;
  onIncrement: () => void;
  onDecrement: () => void;
}

function SteppedField({ label, value, onIncrement, onDecrement }: SteppedFieldProps) {
  // Hold-to-repeat: first delay before repeating, then fast cadence.
  const initialTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopHold = () => {
    if (initialTimerRef.current) {
      clearTimeout(initialTimerRef.current);
      initialTimerRef.current = null;
    }
    if (repeatTimerRef.current) {
      clearInterval(repeatTimerRef.current);
      repeatTimerRef.current = null;
    }
  };

  const startHold = (action: () => void) => {
    stopHold();
    initialTimerRef.current = setTimeout(() => {
      repeatTimerRef.current = setInterval(action, HOLD_REPEAT_INTERVAL_MS);
    }, HOLD_INITIAL_DELAY_MS);
  };

  useEffect(() => stopHold, []);

  return (
    <View style={s.field}>
      <Pressable
        style={({ pressed }) => [s.stepBtn, pressed && s.stepBtnPressed]}
        onPress={onDecrement}
        onPressIn={() => startHold(onDecrement)}
        onPressOut={stopHold}
      >
        <Minus size={16} color="#0F172A" />
      </Pressable>
      <View style={s.valueWrap}>
        <Text style={s.valueText}>{value}</Text>
        <Text style={s.fieldLabel}>{label}</Text>
      </View>
      <Pressable
        style={({ pressed }) => [s.stepBtn, pressed && s.stepBtnPressed]}
        onPress={onIncrement}
        onPressIn={() => startHold(onIncrement)}
        onPressOut={stopHold}
      >
        <Plus size={16} color="#0F172A" />
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { width: '100%' },
  helper: { fontSize: 12, color: '#64748B', marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sep: { fontSize: 22, fontWeight: '700', color: '#94A3B8', marginHorizontal: 2 },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    gap: 4,
  },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBtnPressed: { backgroundColor: '#E2E8F0' },
  valueWrap: { minWidth: 36, alignItems: 'center' },
  valueText: { fontSize: 18, fontWeight: '700', color: '#0F172A', lineHeight: 22 },
  fieldLabel: {
    fontSize: 9,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  periodWrap: {
    flexDirection: 'column',
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    padding: 2,
    marginLeft: 8,
    gap: 2,
  },
  periodBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  periodBtnActive: { backgroundColor: '#0F172A' },
  periodText: { fontSize: 11, fontWeight: '700', color: '#475569' },
  periodTextActive: { color: '#FFFFFF' },
  preview: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748B',
  },
  previewStrong: { color: '#0F172A', fontWeight: '700' },
});
