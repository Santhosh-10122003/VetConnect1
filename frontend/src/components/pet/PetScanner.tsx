import React, { useRef, useState } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { petNumberFromScan } from '../../utils/petLink';
import { themedStyles } from '../../theme/themed';

/**
 * Full-screen camera that reads a pet's QR code. When it sees a Jenni pet code it hands back the pet's number and closes;
 * any other QR code is ignored with a short message.
 */
export const PetScanner: React.FC<{ visible: boolean; onClose: () => void; onFound: (number: string) => void }> = ({ visible, onClose, onFound }) => {
  const [permission, requestPermission] = useCameraPermissions();
  const [message, setMessage] = useState<string | null>(null);
  const handled = useRef(false);
  const lastBad = useRef(0);

  const onScan = ({ data }: { data: string }) => {
    if (handled.current) return;
    const n = petNumberFromScan(data);
    if (n) {
      handled.current = true;
      onFound(n);
      return;
    }
    if (Date.now() - lastBad.current > 1500) {
      lastBad.current = Date.now();
      setMessage('That is not a Jenni pet code. Point at the code on the pet’s tag.');
    }
  };

  const close = () => { handled.current = false; setMessage(null); onClose(); };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close} onShow={() => { handled.current = false; setMessage(null); }}>
      <View style={styles.screen} testID="pet-scanner">
        {!permission ? (
          <ActivityIndicator color="#FFFFFF" style={{ marginTop: 200 }} />
        ) : !permission.granted ? (
          <View style={styles.ask}>
            <Ionicons name="camera-outline" size={44} color="#FFFFFF" />
            <Text style={styles.askTitle}>Allow the camera</Text>
            <Text style={styles.askText}>Jenni needs the camera to read the QR code on a pet's tag. Nothing is recorded.</Text>
            <TouchableOpacity style={styles.allow} onPress={requestPermission} activeOpacity={0.85} testID="scanner-allow">
              <Text style={styles.allowText}>Allow camera</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <CameraView
              style={StyleSheet.absoluteFill as any}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScan}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame}>
                <View style={[styles.corner, styles.tl]} /><View style={[styles.corner, styles.tr]} />
                <View style={[styles.corner, styles.bl]} /><View style={[styles.corner, styles.br]} />
              </View>
              <Text style={styles.hint}>{message ?? 'Point the camera at the pet’s QR code'}</Text>
            </View>
          </>
        )}

        <TouchableOpacity style={styles.close} onPress={close} activeOpacity={0.85} accessibilityLabel="Close scanner" testID="scanner-close">
          <Ionicons name="close" size={26} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const SIZE = 250;
const styles = themedStyles(() => ({
  screen: { flex: 1, backgroundColor: '#000000' },
  overlay: { ...({ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 } as object), alignItems: 'center', justifyContent: 'center' },
  frame: { width: SIZE, height: SIZE },
  corner: { position: 'absolute', width: 44, height: 44, borderColor: '#FFFFFF' },
  tl: { top: 0, left: 0, borderTopWidth: 5, borderLeftWidth: 5, borderTopLeftRadius: 18 },
  tr: { top: 0, right: 0, borderTopWidth: 5, borderRightWidth: 5, borderTopRightRadius: 18 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 5, borderLeftWidth: 5, borderBottomLeftRadius: 18 },
  br: { bottom: 0, right: 0, borderBottomWidth: 5, borderRightWidth: 5, borderBottomRightRadius: 18 },
  hint: { marginTop: 28, color: '#FFFFFF', fontSize: 15, fontWeight: '700', textAlign: 'center', paddingHorizontal: 32, textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  close: { position: 'absolute', top: 54, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  ask: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  askTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: '800', marginTop: 16 },
  askText: { color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  allow: { marginTop: 24, backgroundColor: colors.secondary, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 18 },
  allowText: { color: '#0F1115', fontWeight: '800', fontSize: 15 },
}));
