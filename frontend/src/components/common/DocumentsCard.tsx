import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { shared } from '../../theme/shared';
import { DOCUMENT_LABEL, DocumentType, VerificationDocument, documentApi } from '../../api/documentApi';
import { confirmAction, getErrorMessage, notify } from '../../utils/helpers';

const sizeText = (b: number) => (b >= 1024 * 1024 ? `${(b / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/** The list of uploaded documents. Anyone can open one; only the owner (onRemove given) can remove one. */
export const DocumentList: React.FC<{
  docs: VerificationDocument[];
  onRemove?: (d: VerificationDocument) => void;
  emptyText?: string;
  /** Documents uploaded after this moment get a "New" tag (what was added since the last rejection). */
  newSince?: string;
}> = ({ docs, onRemove, emptyText, newSince }) => {
  const open = async (d: VerificationDocument) => {
    try {
      await documentApi.open(d.id);
    } catch (e) {
      notify('Could not open', getErrorMessage(e));
    }
  };
  if (docs.length === 0) return <Text style={styles.empty}>{emptyText ?? 'Nothing uploaded yet.'}</Text>;
  return (
    <View>
      {docs.map((d) => (
        <View key={d.id} style={styles.row} testID={`doc-${d.id}`}>
          <View style={styles.fileIcon}>
            <Ionicons name={d.contentType === 'application/pdf' ? 'document-text' : 'image'} size={20} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={1}>{d.name}{!!newSince && d.uploadedAt > newSince ? '  NEW' : ''}</Text>
            <Text style={styles.meta}>{DOCUMENT_LABEL[d.type] ?? d.type} · {sizeText(d.sizeBytes)}</Text>
          </View>
          <TouchableOpacity style={styles.action} onPress={() => open(d)} testID={`doc-view-${d.id}`} accessibilityLabel="View document">
            <Text style={styles.actionText}>View</Text>
          </TouchableOpacity>
          {onRemove && (
            <TouchableOpacity style={styles.remove} onPress={() => onRemove(d)} testID={`doc-remove-${d.id}`} accessibilityLabel="Remove document">
              <Ionicons name="trash-outline" size={18} color={colors.danger} />
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
};

/** For doctors and pet-care businesses: upload the certificates an admin checks before approving them. */
export const DocumentsCard: React.FC<{ types: DocumentType[]; hint: string; editable: boolean }> = ({ types, hint, editable }) => {
  const [docs, setDocs] = useState<VerificationDocument[] | null>(null);
  const [type, setType] = useState<DocumentType>(types[0]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setDocs(await documentApi.mine());
    } catch {
      setDocs([]);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.length) return;
    const a = res.assets[0];
    setBusy(true);
    try {
      await documentApi.upload(type, { uri: a.uri, name: a.name, mimeType: a.mimeType, file: (a as { file?: File }).file });
      await load();
    } catch (e) {
      notify('Could not upload', getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (d: VerificationDocument) => {
    if (!(await confirmAction('Remove document', `${d.name} will be deleted.`, 'Remove', true))) return;
    try {
      await documentApi.remove(d.id);
      await load();
    } catch (e) {
      notify('Could not remove', getErrorMessage(e));
    }
  };

  return (
    <View style={[shared.card, { marginTop: 16 }]} testID="documents-card">
      <View style={styles.head}>
        <Ionicons name="folder-open" size={20} color={colors.primary} />
        <Text style={styles.title}>Verification documents</Text>
      </View>
      <Text style={styles.hint}>{hint}</Text>

      {docs === null ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} /> : <DocumentList docs={docs} onRemove={editable ? remove : undefined} emptyText={editable ? 'No documents yet. Upload one so the admin can verify you faster.' : 'No documents were uploaded.'} />}

      {!editable && <Text style={styles.small}>These went to the admin with your application. You can change them only if the admin rejects it.</Text>}
      {editable && <>
      <Text style={[shared.label, { marginTop: 14 }]}>What are you uploading?</Text>
      <View style={shared.chipRow}>
        {types.map((t) => (
          <TouchableOpacity key={t} style={[shared.chip, type === t && shared.chipActive]} onPress={() => setType(t)} testID={`doc-type-${t}`}>
            <Text style={[shared.chipText, type === t && shared.chipTextActive]}>{DOCUMENT_LABEL[t]}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={[styles.upload, busy && { opacity: 0.6 }]} onPress={pick} disabled={busy} activeOpacity={0.85} testID="doc-upload">
        {busy ? <ActivityIndicator color="#FFFFFF" /> : <Ionicons name="cloud-upload-outline" size={18} color="#FFFFFF" />}
        <Text style={styles.uploadText}>{busy ? 'Uploading...' : 'Choose a file (PDF, JPG or PNG)'}</Text>
      </TouchableOpacity>
      <Text style={styles.small}>Up to 5 MB each. Only you and the admin can see them. After uploading, send your application again so the admin sees them.</Text>
      </>}
    </View>
  );
};

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 15, fontWeight: '800', color: colors.text },
  hint: { fontSize: 12, color: colors.textSecondary, marginTop: 6, marginBottom: 10, lineHeight: 17 },
  empty: { fontSize: 13, color: colors.textMuted, marginVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border },
  fileIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: colors.mint, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 13, fontWeight: '700', color: colors.text },
  meta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  action: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 14, backgroundColor: colors.mint },
  actionText: { fontSize: 12, fontWeight: '800', color: colors.primary },
  remove: { padding: 6 },
  upload: { marginTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, borderRadius: 16, paddingVertical: 13 },
  uploadText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  small: { fontSize: 11, color: colors.textMuted, marginTop: 8, textAlign: 'center' },
});

/** For the admin: what an applicant uploaded, so it can be checked against the council or municipal records. */
export const ApplicantDocuments: React.FC<{ ownerType: 'DOCTOR' | 'PROVIDER'; ownerId: number; newSince?: string }> = ({ ownerType, ownerId, newSince }) => {
  const [docs, setDocs] = useState<VerificationDocument[] | null>(null);
  useEffect(() => {
    documentApi.forOwner(ownerType, ownerId).then(setDocs).catch(() => setDocs([]));
  }, [ownerType, ownerId]);
  return (
    <View style={{ marginTop: 12 }} testID="applicant-documents">
      <Text style={shared.label}>Uploaded documents</Text>
      {docs === null ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 8 }} /> : <DocumentList docs={docs} newSince={newSince} emptyText="Nothing uploaded. Ask the applicant for their certificate before approving." />}
    </View>
  );
};
