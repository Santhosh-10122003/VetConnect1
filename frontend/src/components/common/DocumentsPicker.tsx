import React, { useState } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { DOCUMENT_LABEL, DocumentType } from '../../api/documentApi';
import type { QueuedDocument } from '../../utils/pendingDocuments';
import { notify } from '../../utils/helpers';
import { themedStyles } from '../../theme/themed';

const MAX_FILES = 8;
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * Choose certificates while signing up. Nothing is sent yet: they are kept until the account exists and the mobile
 * number is verified (see pendingDocuments).
 */
export const DocumentsPicker: React.FC<{
  types: DocumentType[];
  value: QueuedDocument[];
  onChange: (docs: QueuedDocument[]) => void;
  hint: string;
}> = ({ types, value, onChange, hint }) => {
  const [type, setType] = useState<DocumentType>(types[0]);

  const pick = async () => {
    if (value.length >= MAX_FILES) return notify('Too many files', `You can add up to ${MAX_FILES} documents.`);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    if (a.size && a.size > MAX_BYTES) return notify('File too large', 'Each document can be up to 5 MB.');
    onChange([...value, { type, file: { uri: a.uri, name: a.name, mimeType: a.mimeType, file: (a as { file?: File }).file } }]);
  };

  return (
    <View testID="docs-picker">
      <Text style={styles.label}>Upload your documents</Text>
      <Text style={styles.hint}>{hint}</Text>

      {value.map((d, i) => (
        <View key={`${d.file.name}-${i}`} style={styles.row} testID={`picked-doc-${i}`}>
          <View style={styles.icon}><Ionicons name={d.file.mimeType === 'application/pdf' ? 'document-text' : 'image'} size={18} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{d.file.name}</Text>
            <Text style={styles.meta}>{DOCUMENT_LABEL[d.type]}</Text>
          </View>
          <TouchableOpacity onPress={() => onChange(value.filter((_, j) => j !== i))} style={{ padding: 6 }} accessibilityLabel="Remove document" testID={`picked-doc-remove-${i}`}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>
      ))}

      <View style={styles.chips}>
        {types.map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, type === t && styles.chipOn]} onPress={() => setType(t)} activeOpacity={0.85} testID={`reg-doc-type-${t}`}>
            <Text style={[styles.chipText, type === t && { color: '#FFFFFF' }]}>{DOCUMENT_LABEL[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={styles.upload} onPress={pick} activeOpacity={0.85} testID="reg-doc-upload">
        <Ionicons name="cloud-upload-outline" size={18} color={colors.primary} />
        <Text style={styles.uploadText}>Choose a file (PDF, JPG or PNG)</Text>
      </TouchableOpacity>
      <Text style={styles.small}>Up to 5 MB each. They are uploaded as soon as you confirm your mobile number.</Text>
    </View>
  );
};

const styles = themedStyles(() => ({
  label: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 4 },
  hint: { fontSize: 12, color: colors.textMuted, lineHeight: 17, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.mint, borderRadius: 14, padding: 10, marginBottom: 8 },
  icon: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.card, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.textSecondary, marginTop: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, backgroundColor: colors.subtle },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  upload: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.mintDark, borderRadius: 16, paddingVertical: 14, backgroundColor: colors.card },
  uploadText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  small: { fontSize: 11, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
}));
