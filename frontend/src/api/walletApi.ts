import { apiClient } from './client';

export interface WalletTransaction {
  id: number;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  currency: string;
  description: string;
  reference?: string;
  createdAt: string;
}

export interface Wallet {
  balance: number;
  totalEarned: number;
  totalRefunded: number;
  currency: string;
  currencySymbol: string;
  transactions: { content: WalletTransaction[]; totalPages: number; totalElements: number };
}

export const walletApi = {
  async mine(page = 0, size = 30) {
    const res = await apiClient.get<{ success: boolean; data: Wallet }>('/wallet', { params: { page, size } });
    return res.data.data;
  },
};
