import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
  TextInput,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  label?: string;
  placeholder?: string;
  /** The currently selected value (matched against option.value). */
  value?: string;
  /** Shown when the value is not (or not yet) one of the options, e.g. a place that came from a lookup. */
  displayValue?: string;
  options: SelectOption[];
  onSelect: (option: SelectOption) => void;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  searchPlaceholder?: string;
  emptyText?: string;
  testID?: string;
}

/** A dropdown: tap to open a searchable list (works for lists with thousands of entries). */
export const SelectField: React.FC<Props> = ({
  label,
  placeholder = 'Select',
  value,
  displayValue,
  options,
  onSelect,
  disabled,
  loading,
  error,
  icon,
  searchPlaceholder = 'Search',
  emptyText = 'Nothing found',
  testID,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const selected = options.find((o) => o.value === value);
  const shown = selected?.label ?? displayValue;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const close = () => {
    setOpen(false);
    setQuery('');
  };

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TouchableOpacity
        testID={testID}
        style={[styles.box, disabled && styles.disabled, error ? styles.errorBorder : null]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={label}
      >
        {icon ? <Ionicons name={icon} size={20} color={colors.textMuted} style={{ marginRight: 8 }} /> : null}
        <Text style={[styles.value, !shown && styles.placeholder]} numberOfLines={1}>
          {shown || placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
        )}
      </TouchableOpacity>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Modal visible={open} animationType="slide" onRequestClose={close}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{label || placeholder}</Text>
            <TouchableOpacity onPress={close} hitSlop={10} accessibilityLabel="Close">
              <Ionicons name="close" size={26} color={colors.text} />
            </TouchableOpacity>
          </View>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.textMuted}
              value={query}
              onChangeText={setQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(o, i) => `${o.value}:${i}`}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={<Text style={styles.empty}>{emptyText}</Text>}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.row}
                onPress={() => {
                  onSelect(item);
                  close();
                }}
              >
                <Text style={[styles.rowText, item.value === value && styles.rowTextActive]}>{item.label}</Text>
                {item.value === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
              </TouchableOpacity>
            )}
          />
        </SafeAreaView>
      </Modal>
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
  disabled: { opacity: 0.5 },
  errorBorder: { borderColor: colors.danger },
  value: { flex: 1, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textMuted },
  error: { color: colors.danger, fontSize: 12, marginTop: 4 },
  modal: { flex: 1, backgroundColor: colors.background },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    height: 46,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowText: { fontSize: 15, color: colors.text, flex: 1 },
  rowTextActive: { fontWeight: '800', color: colors.primary },
  empty: { textAlign: 'center', color: colors.textSecondary, padding: 30 },
});
