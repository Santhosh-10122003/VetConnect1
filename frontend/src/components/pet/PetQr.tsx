import React, { useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { colors } from '../../theme/colors';
import { petLink } from '../../utils/petLink';
import { notify } from '../../utils/helpers';

const PRINT_SIZE = 900; // the downloaded picture is big and sharp, so it prints well

const fileName = (name?: string) => `${(name || 'pet').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'pet'}-QR.png`;

/**
 * The pet's QR code: a plain black-and-white code on a white card (the easiest kind for any phone to scan), with the
 * pet's name and a small paw underneath, and a button that saves the code as a picture to print or share.
 * Whoever scans it is taken to the page that shows how to reach the owner.
 */
export const PetQr: React.FC<{ number: string; name?: string; size?: number }> = ({ number, name, size = 210 }) => {
  const link = petLink(number);
  const big = useRef<{ toDataURL: (cb: (data: string) => void) => void } | null>(null);
  const [busy, setBusy] = useState(false);

  const download = () => {
    if (!big.current) return notify('Not ready', 'Please try again in a moment.');
    setBusy(true);
    big.current.toDataURL(async (base64: string) => {
      try {
        const file = fileName(name);
        if (Platform.OS === 'web') {
          const a = document.createElement('a');
          a.href = `data:image/png;base64,${base64}`;
          a.download = file;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } else {
          const uri = `${FileSystem.cacheDirectory}${file}`;
          await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
          if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Save or share the QR code' });
          else notify('Saved', 'The QR code picture was saved.');
        }
      } catch {
        notify('Could not save', 'The picture could not be saved. Please try again.');
      } finally {
        setBusy(false);
      }
    });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.card} testID="pet-qr" accessibilityLabel={link}>
        <QRCode value={link} size={size} color="#000000" backgroundColor="#FFFFFF" ecl="M" quietZone={4} />
        <View style={styles.footer}>
          <Ionicons name="paw" size={16} color={colors.textSecondary} />
          {!!name && <Text style={styles.name} numberOfLines={1}>{name}</Text>}
        </View>
        <Text style={styles.caption}>Scan to reach the owner</Text>
      </View>

      <TouchableOpacity style={[styles.btn, busy && { opacity: 0.6 }]} onPress={download} disabled={busy} activeOpacity={0.85} testID="qr-download">
        <Ionicons name={Platform.OS === 'web' ? 'download-outline' : 'share-outline'} size={18} color={colors.primary} />
        <Text style={styles.btnText}>{busy ? 'Preparing...' : Platform.OS === 'web' ? 'Download picture' : 'Save or share picture'}</Text>
      </TouchableOpacity>

      {/* a large copy of the same code, out of sight, that the picture is made from */}
      <View style={styles.hidden} pointerEvents="none">
        <QRCode value={link} size={PRINT_SIZE} color="#000000" backgroundColor="#FFFFFF" ecl="M" quietZone={40} getRef={(c) => { big.current = c; }} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  card: { alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 14 },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  name: { fontSize: 17, fontWeight: '800', color: colors.text, maxWidth: 200 },
  caption: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 4 },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 16, backgroundColor: colors.mint },
  btnText: { fontSize: 14, fontWeight: '800', color: colors.ink },
  hidden: { position: 'absolute', left: -10000, top: 0, width: PRINT_SIZE, height: PRINT_SIZE, opacity: 0 },
});
