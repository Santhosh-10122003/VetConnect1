import { Alert, Platform } from 'react-native';

/** Extracts the backend's ApiResponse message (or a network fallback) from an axios error. */
export const getErrorMessage = (e: any, fallback = 'Something went wrong. Please try again.'): string => {
  const data = e?.response?.data;
  if (data?.message) return data.message;
  if (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error') {
    return 'Cannot reach the server. Check your connection and API URL.';
  }
  return fallback;
};

/** Cross-platform alert (react-native Alert is a no-op on web). */
export const notify = (title: string, message?: string) => {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
};

/** Cross-platform confirm dialog resolving to the user's choice. */
export const confirmAction = (
  title: string,
  message: string,
  confirmText = 'Confirm',
  destructive = false
): Promise<boolean> => {
  if (Platform.OS === 'web') {
    return Promise.resolve(window.confirm(`${title}\n\n${message}`));
  }
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: 'Back', style: 'cancel', onPress: () => resolve(false) },
        { text: confirmText, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
};

export const todayIso = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

export const hhmm = (t?: string) => (t ? t.substring(0, 5) : '');

export const petAge = (dob?: string): string => {
  if (!dob) return 'Age unknown';
  const born = new Date(dob);
  if (isNaN(born.getTime())) return 'Age unknown';
  const months = (new Date().getFullYear() - born.getFullYear()) * 12 + (new Date().getMonth() - born.getMonth());
  if (months < 1) return 'Newborn';
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yrs`;
};

export const DAY_NAMES = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** "Dr. " prefix exactly once, whether or not the stored name already has it. */
export const drName = (name?: string): string => `Dr. ${(name || '').replace(/^Dr\.?\s*/i, '')}`.trim();

let currencySymbol = '$';
/** Called once at start-up with the server's currency (e.g. "$" or "₹"). */
let clinicAdvancePercent = 50;
/** Share of a vet consultation fee that is paid up front (from the server's config). */
export const setClinicAdvancePercent = (percent: number) => { clinicAdvancePercent = percent > 0 ? percent : 50; };
export const getClinicAdvancePercent = () => clinicAdvancePercent;

let paymentGateway: 'simulated' | 'razorpay' = 'simulated';
/** Which payment gateway the server is using (from its config). */
export const setPaymentGateway = (g: string) => { paymentGateway = g === 'razorpay' ? 'razorpay' : 'simulated'; };
export const getPaymentGateway = () => paymentGateway;

export const getCurrencySymbol = () => currencySymbol;
export const setCurrencySymbol = (symbol: string) => { currencySymbol = symbol || '$'; };

export const money = (amount: number | string | undefined | null, digits = 2): string =>
  `${currencySymbol}${Number(amount ?? 0).toFixed(digits)}`;

/** The email to show, or undefined for the internal address of an account that signed up with a mobile number only. */
export const visibleEmail = (email?: string | null): string | undefined =>
  !email || email.endsWith('@mobile.vetconnect.local') ? undefined : email;
