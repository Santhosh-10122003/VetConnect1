import React, { useEffect } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { colors } from '../../theme/colors';
import type { CarePayment } from '../../api/careApi';

const NativeWebView = WebView as unknown as React.ComponentType<any>;

export interface CheckoutSuccess {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

interface Props {
  payment: CarePayment;
  /** Shown on Razorpay's sheet, e.g. "Advance for appointment VC-2027...". */
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  onSuccess: (result: CheckoutSuccess) => void;
  /** The payment was declined or the checkout could not load. The slot stays held, so the customer can retry. */
  onFailure: (message: string) => void;
  /** Closed without paying. */
  onDismiss: () => void;
}

/** What Razorpay's checkout.js needs: the order made by the server, in the smallest currency unit. */
const checkoutOptions = (p: CarePayment, description: string, prefill: Props['prefill']) => ({
  key: p.keyId,
  order_id: p.gatewayOrderId,
  amount: Math.round(p.amount * 100),
  currency: p.currency,
  name: 'VetConnect',
  description,
  prefill: prefill ?? {},
  theme: { color: colors.primary },
});

/** One script for both the phone (inside a WebView) and the browser: opens Razorpay and reports back by message. */
const bridgeScript = (options: object) => `
  var post = function (o) {
    var s = JSON.stringify(o);
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(s); else window.parent.postMessage(s, '*');
  };
  var opts = ${JSON.stringify(options).replace(/</g, '\\u003c')};
  opts.handler = function (r) { post({ type: 'success', data: r }); };
  opts.modal = { ondismiss: function () { post({ type: 'dismiss' }); } };
  function start() {
    if (typeof Razorpay === 'undefined') { post({ type: 'failed', message: 'Could not load the payment page. Check your internet connection.' }); return; }
    var rz = new Razorpay(opts);
    rz.on('payment.failed', function (r) { post({ type: 'failed', message: (r && r.error && r.error.description) || 'The payment was declined.' }); });
    rz.open();
  }
`;

const pageHtml = (options: object) => `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;font-family:sans-serif;background:#fff;color:#64748B;display:flex;align-items:center;justify-content:center;height:100vh}</style></head>
<body>Opening secure payment...
<script>${bridgeScript(options)}</script>
<script src="https://checkout.razorpay.com/v1/checkout.js" onload="start()" onerror="post({type:'failed',message:'Could not load the payment page. Check your internet connection.'})"></script>
</body></html>`;

/** Razorpay's own page asks for the card, UPI or net-banking details: they never pass through this app or our server. */
export const RazorpayCheckout: React.FC<Props> = ({ payment, description, prefill, onSuccess, onFailure, onDismiss }) => {
  const options = checkoutOptions(payment, description, prefill);

  const handle = (raw: string) => {
    let msg: any;
    try { msg = JSON.parse(raw); } catch { return; }
    if (msg.type === 'success') {
      onSuccess({
        razorpayOrderId: msg.data.razorpay_order_id,
        razorpayPaymentId: msg.data.razorpay_payment_id,
        razorpaySignature: msg.data.razorpay_signature,
      });
    } else if (msg.type === 'failed') onFailure(msg.message || 'The payment was declined.');
    else if (msg.type === 'dismiss') onDismiss();
  };

  // In a browser the checkout opens on top of the page, so there is nothing to render.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (e: MessageEvent) => { if (typeof e.data === 'string') handle(e.data); };
    window.addEventListener('message', listener);
    const run = () => {
      // eslint-disable-next-line no-new-func
      new Function(bridgeScript(options) + '; start();')();
    };
    if ((window as any).Razorpay) run();
    else {
      const el = document.createElement('script');
      el.src = 'https://checkout.razorpay.com/v1/checkout.js';
      el.onload = run;
      el.onerror = () => onFailure('Could not load the payment page. Check your internet connection.');
      document.body.appendChild(el);
    }
    return () => window.removeEventListener('message', listener);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (Platform.OS === 'web') return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onDismiss}>
      <SafeAreaProvider>
      <SafeAreaView style={styles.screen}>
        <View style={styles.bar}>
          <Text style={styles.title}>Secure payment</Text>
          <TouchableOpacity onPress={onDismiss} hitSlop={10}><Text style={styles.close}>Close</Text></TouchableOpacity>
        </View>
        <NativeWebView
          originWhitelist={['*']}
          source={{ html: pageHtml(options), baseUrl: 'https://checkout.razorpay.com' }}
          javaScriptEnabled
          domStorageEnabled
          setSupportMultipleWindows={false}
          onMessage={(e: WebViewMessageEvent) => handle(e.nativeEvent.data)}
          style={{ flex: 1 }}
        />
      </SafeAreaView>
      </SafeAreaProvider>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF' },
  bar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  title: { fontSize: 16, fontWeight: '800', color: colors.text },
  close: { fontSize: 14, fontWeight: '700', color: colors.primary },
});
