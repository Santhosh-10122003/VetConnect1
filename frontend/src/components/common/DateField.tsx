import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Modal } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface Props {
  label?: string;
  /** ISO date, YYYY-MM-DD ('' when empty). */
  value: string;
  onChange: (iso: string) => void;
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  error?: string;
  /** Show a "Clear" action for optional dates. */
  clearable?: boolean;
  testID?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
export const toIso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
/** Parse as a local date (new Date('2024-03-01') would be UTC and can show the previous day). */
export const fromIso = (iso: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
const pretty = (iso: string) =>
  fromIso(iso)?.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) ?? '';

/**
 * A date box: tap it and pick from the calendar (native dialog on Android, wheel on iOS,
 * the browser's date input on web). The value is always an ISO date string.
 */
export const DateField: React.FC<Props> = ({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = 'Select date',
  error,
  clearable,
  testID,
}) => {
  const [open, setOpen] = useState(false);
  const current = fromIso(value) ?? new Date();

  const onNativeChange = (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setOpen(false);
    if (event.type === 'set' && date) onChange(toIso(date));
    if (event.type === 'dismissed') setOpen(false);
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      {Platform.OS === 'web' ? (
        <View style={[styles.box, error ? styles.errorBorder : null]}>
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
          {React.createElement('input', {
            type: 'date',
            value,
            min: minimumDate ? toIso(minimumDate) : undefined,
            max: maximumDate ? toIso(maximumDate) : undefined,
            'aria-label': label || placeholder,
            'data-testid': testID,
            onChange: (e: any) => onChange(e.target.value),
            style: {
              flex: 1,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              fontSize: 15,
              fontFamily: 'inherit',
              color: value ? colors.text : colors.textMuted,
            },
          })}
        </View>
      ) : (
        <TouchableOpacity
          testID={testID}
          style={[styles.box, error ? styles.errorBorder : null]}
          onPress={() => setOpen(true)}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={label || placeholder}
        >
          <Ionicons name="calendar-outline" size={20} color={colors.textMuted} style={{ marginRight: 8 }} />
          <Text style={[styles.value, !value && styles.placeholder]}>{value ? pretty(value) : placeholder}</Text>
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        </TouchableOpacity>
      )}

      {clearable && !!value && (
        <TouchableOpacity onPress={() => onChange('')} style={styles.clear}>
          <Text style={styles.clearText}>Clear date</Text>
        </TouchableOpacity>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS === 'android' && open && (
        <DateTimePicker value={current} mode="date" display="default" minimumDate={minimumDate} maximumDate={maximumDate} onChange={onNativeChange} />
      )}
      {Platform.OS === 'ios' && (
        <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
          <View style={styles.sheetBackdrop}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setOpen(false)}>
                  <Text style={styles.sheetAction}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={current}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                onChange={(e, d) => {
                  if (d) onChange(toIso(d));
                }}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#FFFFFF',
  },
  errorBorder: { borderColor: colors.danger },
  value: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  clear: { alignSelf: 'flex-start', marginTop: 6 },
  clearText: { color: colors.primary, fontWeight: '700', fontSize: 12 },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  sheet: { backgroundColor: '#FFFFFF', paddingBottom: 24, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 14 },
  sheetAction: { color: colors.primary, fontWeight: '800', fontSize: 16 },
});
