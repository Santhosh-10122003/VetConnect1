import type { SelectOption } from '../components/common/SelectField';

const PLACES = [
  'Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir',
  'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

/**
 * Every state and union territory, plus the national Veterinary Council of India and an "Other" for anything not listed.
 * The names follow one pattern; the registration number and council are checked by the admin against the council's own register.
 */
export const VET_COUNCILS: SelectOption[] = [
  ...PLACES.map((p) => ({ value: `${p} State Veterinary Council`, label: `${p} State Veterinary Council` })),
  { value: 'Veterinary Council of India', label: 'Veterinary Council of India (VCI)' },
  { value: 'Other', label: 'Other' },
];
