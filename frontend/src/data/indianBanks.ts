import type { SelectOption } from '../components/common/SelectField';

/**
 * The banks people in India commonly hold accounts with: public sector, private, small finance, payments banks,
 * foreign banks with branches in India, the larger cooperative banks, and the regional rural banks' sponsors.
 * "Other" covers any bank not listed (a district cooperative bank, for instance).
 */
const BANKS: string[] = [
  // Public sector
  'State Bank of India', 'Punjab National Bank', 'Bank of Baroda', 'Canara Bank', 'Union Bank of India', 'Bank of India',
  'Indian Bank', 'Central Bank of India', 'Indian Overseas Bank', 'UCO Bank', 'Bank of Maharashtra', 'Punjab & Sind Bank',
  // Private sector
  'HDFC Bank', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra Bank', 'IndusInd Bank', 'Yes Bank', 'IDFC FIRST Bank',
  'Federal Bank', 'South Indian Bank', 'Karur Vysya Bank', 'City Union Bank', 'Tamilnad Mercantile Bank', 'Karnataka Bank',
  'RBL Bank', 'Bandhan Bank', 'CSB Bank', 'DCB Bank', 'Dhanlaxmi Bank', 'IDBI Bank', 'Jammu & Kashmir Bank', 'Nainital Bank',
  'AU Small Finance Bank',
  // Small finance banks
  'Equitas Small Finance Bank', 'Ujjivan Small Finance Bank', 'Jana Small Finance Bank', 'Suryoday Small Finance Bank',
  'ESAF Small Finance Bank', 'Capital Small Finance Bank', 'Utkarsh Small Finance Bank', 'North East Small Finance Bank',
  'Fincare Small Finance Bank', 'Shivalik Small Finance Bank', 'Unity Small Finance Bank',
  // Payments banks
  'India Post Payments Bank', 'Airtel Payments Bank', 'Paytm Payments Bank', 'Fino Payments Bank', 'Jio Payments Bank',
  'NSDL Payments Bank',
  // Foreign banks
  'Citibank', 'HSBC', 'Standard Chartered Bank', 'Deutsche Bank', 'DBS Bank India', 'Barclays Bank', 'Bank of America',
  'JPMorgan Chase Bank', 'Doha Bank', 'Mizuho Bank', 'MUFG Bank', 'Sumitomo Mitsui Banking Corporation', 'Emirates NBD',
  // Larger cooperative banks
  'Saraswat Co-operative Bank', 'Cosmos Co-operative Bank', 'Abhyudaya Co-operative Bank', 'TJSB Sahakari Bank',
  'Bharat Co-operative Bank', 'Shamrao Vithal Co-operative Bank', 'The Mehsana Urban Co-operative Bank', 'NKGSB Co-operative Bank',
  'Kalupur Commercial Co-operative Bank', 'Nutan Nagarik Sahakari Bank', 'Janata Sahakari Bank', 'Apna Sahakari Bank',
  'The Kerala State Co-operative Bank', 'Tamil Nadu State Apex Co-operative Bank', 'Karnataka State Co-operative Apex Bank',
  'Maharashtra State Co-operative Bank', 'Gujarat State Co-operative Bank', 'Punjab State Co-operative Bank',
  'Andhra Pradesh State Co-operative Bank', 'Telangana State Co-operative Apex Bank', 'Rajasthan State Co-operative Bank',
  'Uttar Pradesh Co-operative Bank', 'West Bengal State Co-operative Bank', 'Bihar State Co-operative Bank',
  // Regional rural banks (the larger ones)
  'Andhra Pradesh Grameena Vikas Bank', 'Telangana Grameena Bank', 'Karnataka Grameena Bank', 'Karnataka Vikas Grameena Bank',
  'Kerala Gramin Bank', 'Tamil Nadu Grama Bank', 'Pallavan Grama Bank', 'Puducherry Grama Bank', 'Maharashtra Gramin Bank',
  'Baroda Uttar Pradesh Gramin Bank', 'Baroda Rajasthan Kshetriya Gramin Bank', 'Baroda Gujarat Gramin Bank',
  'Uttar Bihar Gramin Bank', 'Dakshin Bihar Gramin Bank', 'Madhya Bihar Gramin Bank', 'Odisha Gramya Bank', 'Utkal Grameen Bank',
  'Assam Gramin Vikash Bank', 'Paschim Banga Gramin Bank', 'Bangiya Gramin Vikash Bank', 'Uttarakhand Gramin Bank',
  'Himachal Pradesh Gramin Bank', 'Punjab Gramin Bank', 'Haryana Gramin Bank', 'Rajasthan Marudhara Gramin Bank',
  'Madhya Pradesh Gramin Bank', 'Chhattisgarh Rajya Gramin Bank', 'Jharkhand Rajya Gramin Bank', 'Meghalaya Rural Bank',
  'Tripura Gramin Bank', 'Arunachal Pradesh Rural Bank', 'Mizoram Rural Bank', 'Nagaland Rural Bank', 'Manipur Rural Bank',
  'Ellaquai Dehati Bank', 'J&K Grameen Bank', 'Saptagiri Grameena Bank', 'Prathama UP Gramin Bank', 'Sarva UP Gramin Bank',
];

const sorted = Array.from(new Set(BANKS)).sort((a, b) => a.localeCompare(b));

export const INDIAN_BANKS: SelectOption[] = [
  ...sorted.map((b) => ({ value: b, label: b })),
  { value: 'Other', label: 'Other (not in the list)' },
];
