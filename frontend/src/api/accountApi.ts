import { apiClient } from './client';
import type { ProviderPayload } from './careApi';

export const accountApi = {
  /** A pet owner turns this account into a pet-care business (sent to the admin for approval). */
  async becomeBusiness(payload: ProviderPayload) {
    await apiClient.post('/account/become-business', payload);
  },

  /** Deletes the signed-in account for good. The password is asked again so nobody else can do it from an open phone. */
  async deleteMine(password: string) {
    await apiClient.post('/account/delete', { password });
  },
};
