import { KeyboardTypeOptions, TextInputProps } from 'react-native';

/**
 * What each kind of field accepts. Typing is filtered as it happens (a character that does not belong never appears)
 * and the value is checked when the person leaves the field. The server repeats the emoji rule on every text field.
 */
export type InputKind =
  | 'name' // a person: letters, spaces . ' -
  | 'business' // a clinic or shop name
  | 'text' // a short free line
  | 'address'
  | 'note' // long free text
  | 'regNo' // a registration / licence number
  | 'degree'
  | 'integer'
  | 'decimal'
  | 'phone'
  | 'pin'
  | 'otp'
  | 'code' // an 8 character reset code
  | 'ifsc'
  | 'upi'
  | 'account'
  | 'bank'
  | 'petName'
  | 'drug'
  | 'dosage'
  | 'time';

// Emoji and picture-like symbols, flags, joiners, variation selectors, hidden / control characters.
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{2460}-\u{24FF}\u{25A0}-\u{27BF}\u{2900}-\u{297F}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200B}-\u{200F}\u{202A}-\u{202E}\u{2060}-\u{2064}\u{FEFF}\u{20E3}\u{E0020}-\u{E007F}\u{00A9}\u{00AE}\u{2122}]/gu;
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Removes emoji and hidden characters; the base of every other rule. */
export const stripEmoji = (s: string): string => s.replace(EMOJI_RE, '').replace(CONTROL_RE, '');
export const hasEmoji = (s: string): boolean => { EMOJI_RE.lastIndex = 0; return EMOJI_RE.test(s); };

const collapse = (s: string) => s.replace(/ {2,}/g, ' ').replace(/^ /, '');

interface Rule {
  /** Keeps only what belongs; runs on every keystroke. */
  clean: (s: string) => string;
  /** A problem with a non-empty value, or null. */
  check?: (s: string) => string | null;
  maxLength: number;
  keyboard?: KeyboardTypeOptions;
  capitalize?: TextInputProps['autoCapitalize'];
}

const LETTERS = 'A-Za-z\\u00C0-\\u024F\\u0900-\\u097F\\u0980-\\u09FF\\u0A00-\\u0A7F\\u0A80-\\u0AFF\\u0B00-\\u0B7F\\u0B80-\\u0BFF\\u0C00-\\u0C7F\\u0C80-\\u0CFF\\u0D00-\\u0D7F\\u0600-\\u06FF';
const re = (body: string, flags = 'g') => new RegExp(body, flags);

const RULES: Record<InputKind, Rule> = {
  name: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS} .'’-]`), '')),
    check: (s) => (s.trim().length < 2 ? 'Enter at least 2 letters' : !re(`[${LETTERS}]`, '').test(s) ? 'Use letters only' : null),
    maxLength: 60,
    capitalize: 'words',
  },
  business: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS}0-9 &.,'’()/-]`), '')),
    check: (s) => (s.trim().length < 2 ? 'Enter at least 2 characters' : !re(`[${LETTERS}0-9]`, '').test(s) ? 'Use letters or numbers' : null),
    maxLength: 80,
    capitalize: 'words',
  },
  text: {
    clean: (s) => collapse(stripEmoji(s).replace(/[<>{}\\^|~`]/g, '')),
    maxLength: 100,
  },
  address: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS}0-9 ,.#/()'’&:-]`), '')),
    check: (s) => (s.trim().length < 5 ? 'Enter the full address' : !re(`[${LETTERS}0-9]`, '').test(s) ? 'Use letters or numbers' : null),
    maxLength: 200,
  },
  note: {
    clean: (s) => stripEmoji(s).replace(/[<>{}\\^|~`]/g, ''),
    maxLength: 1000,
    capitalize: 'sentences',
  },
  regNo: {
    clean: (s) => stripEmoji(s).replace(/[^A-Za-z0-9/ .-]/g, '').toUpperCase().replace(/ {2,}/g, ' ').replace(/^ /, ''),
    check: (s) => (s.replace(/[^A-Za-z0-9]/g, '').length < 4 ? 'Enter the full number' : null),
    maxLength: 30,
    capitalize: 'characters',
  },
  degree: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS} .,&()/-]`), '')),
    check: (s) => (s.trim().length < 2 ? 'Enter your degree, like B.V.Sc. & A.H.' : null),
    maxLength: 60,
  },
  integer: { clean: (s) => s.replace(/\D/g, ''), maxLength: 6, keyboard: 'number-pad' },
  decimal: {
    clean: (s) => {
      const t = s.replace(/,/g, '.').replace(/[^\d.]/g, '');
      const i = t.indexOf('.');
      if (i < 0) return t;
      return t.slice(0, i + 1) + t.slice(i + 1).replace(/\./g, '').slice(0, 2);
    },
    maxLength: 9,
    keyboard: 'decimal-pad',
  },
  phone: {
    clean: (s) => s.replace(/[^\d+ ()-]/g, '').replace(/(?!^)\+/g, ''),
    check: (s) => (/^\+?[\d ()-]{7,20}$/.test(s) && s.replace(/\D/g, '').length >= 7 ? null : 'Enter a valid phone number'),
    maxLength: 20,
    keyboard: 'phone-pad',
  },
  pin: {
    clean: (s) => s.replace(/\D/g, ''),
    check: (s) => (/^[1-9]\d{5}$/.test(s) ? null : 'A PIN code has 6 digits'),
    maxLength: 6,
    keyboard: 'number-pad',
  },
  otp: { clean: (s) => s.replace(/\D/g, ''), check: (s) => (s.length === 6 ? null : 'Enter the 6 digit code'), maxLength: 6, keyboard: 'number-pad' },
  code: { clean: (s) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase(), check: (s) => (s.length === 8 ? null : 'The code has 8 characters'), maxLength: 8, capitalize: 'characters' },
  ifsc: {
    clean: (s) => s.replace(/[^A-Za-z0-9]/g, '').toUpperCase(),
    check: (s) => (/^[A-Z]{4}0[A-Z0-9]{6}$/.test(s) ? null : 'An IFSC has 11 characters, like HDFC0001234'),
    maxLength: 11,
    capitalize: 'characters',
  },
  upi: {
    clean: (s) => s.replace(/[^A-Za-z0-9._@-]/g, '').toLowerCase(),
    check: (s) => (/^[a-z0-9._-]{2,256}@[a-z][a-z0-9]{1,63}$/.test(s) ? null : 'Enter a UPI id like name@bank'),
    maxLength: 80,
    capitalize: 'none',
  },
  account: {
    clean: (s) => s.replace(/\D/g, ''),
    check: (s) => (s.length >= 9 && s.length <= 18 ? null : 'An account number has 9 to 18 digits'),
    maxLength: 18,
    keyboard: 'number-pad',
  },
  bank: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS} .&()-]`), '')),
    maxLength: 60,
    capitalize: 'words',
  },
  petName: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS}0-9 .'’-]`), '')),
    check: (s) => (s.trim().length < 1 ? 'Enter a name' : null),
    maxLength: 40,
    capitalize: 'words',
  },
  drug: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS}0-9 .,()/+%-]`), '')),
    maxLength: 80,
  },
  dosage: {
    clean: (s) => collapse(stripEmoji(s).replace(re(`[^${LETTERS}0-9 .,/%()-]`), '')),
    maxLength: 60,
  },
  time: {
    clean: (s) => s.replace(/[^\d:]/g, ''),
    check: (s) => (/^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? null : 'Use the 24 hour form, like 09:30'),
    maxLength: 5,
    keyboard: 'numbers-and-punctuation',
  },
};

export const cleanInput = (kind: InputKind, value: string): string => RULES[kind].clean(value);
export const inputMaxLength = (kind: InputKind): number => RULES[kind].maxLength;
export const inputKeyboard = (kind: InputKind): KeyboardTypeOptions | undefined => RULES[kind].keyboard;
export const inputCapitalize = (kind: InputKind): TextInputProps['autoCapitalize'] | undefined => RULES[kind].capitalize;

/** A message when a non-empty value is not acceptable for this kind, otherwise null (an empty value is the form's business). */
export const inputError = (kind: InputKind, value: string): string | null => {
  if (!value.trim()) return null;
  if (hasEmoji(value)) return 'Emoji and special symbols are not allowed';
  return RULES[kind].check ? RULES[kind].check!(value) : null;
};
