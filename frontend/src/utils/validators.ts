/**
 * Email validation in the style of consumer apps (Zomato, Swiggy...): a real-looking address with a proper
 * domain and top-level domain, no spaces or doubled dots, plus a "did you mean gmail.com?" typo hint.
 */

export const normalizeEmail = (value: string): string => value.trim().toLowerCase();

// Same rule as the backend (RegisterRequest): keep them in step.
const EMAIL_RE =
  /^(?!.*\.\.)[A-Za-z0-9](?:[A-Za-z0-9._%+-]{0,62}[A-Za-z0-9])?@(?:[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?\.)+[A-Za-z]{2,24}$/;

/** Returns an error message, or null when the address looks valid. */
export const emailError = (raw: string): string | null => {
  const value = raw.trim();
  if (!value) return 'Enter your email address';
  if (/\s/.test(value)) return 'Email cannot contain spaces';
  if (!value.includes('@')) return 'Email must contain @, like name@example.com';
  if (value.length > 254) return 'Email is too long';
  if (!EMAIL_RE.test(value)) return 'Enter a valid email address, like name@example.com';
  return null;
};

export const isValidEmail = (raw: string): boolean => emailError(raw) === null;

const POPULAR_DOMAINS = [
  'gmail.com', 'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'outlook.com', 'hotmail.com', 'live.com',
  'icloud.com', 'rediffmail.com', 'proton.me', 'protonmail.com', 'aol.com', 'zoho.com',
];

const editDistance = (a: string, b: string): number => {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[a.length][b.length];
};

/** For a valid-looking address on a near-miss of a popular provider (gmial.com), the corrected address. */
export const emailSuggestion = (raw: string): string | null => {
  const value = normalizeEmail(raw);
  if (!isValidEmail(value)) return null;
  const [local, domain] = value.split('@');
  if (POPULAR_DOMAINS.includes(domain)) return null;
  let best: { d: string; dist: number } | null = null;
  for (const d of POPULAR_DOMAINS) {
    const dist = editDistance(domain, d);
    if (dist > 0 && dist <= 2 && (!best || dist < best.dist)) best = { d, dist };
  }
  return best ? `${local}@${best.d}` : null;
};

export const passwordError = (password: string): string | null => {
  if (!password) return 'Enter a password';
  if (password.length < 6) return 'Password must be at least 6 characters';
  return null;
};

export const confirmPasswordError = (password: string, confirm: string): string | null => {
  if (!confirm) return 'Re-enter your password';
  if (password !== confirm) return 'Passwords do not match';
  return null;
};

/**
 * Mobile numbers are typed with their country code (+91 98765 43210) and sent in international form.
 */
export const normalizePhone = (raw: string): string => {
  let s = raw.trim().replace(/[\s().-]/g, '');
  if (s.startsWith('00')) s = '+' + s.slice(2);
  return s;
};

export const phoneError = (raw: string): string | null => {
  const value = raw.trim();
  if (!value || value === '+') return 'Enter your mobile number';
  const s = normalizePhone(value);
  if (!s.startsWith('+')) return 'Start with your country code, like +91';
  if (!/^\+[1-9][0-9]{6,14}$/.test(s)) return 'Enter a valid mobile number, like +91 98765 43210';
  return null;
};
