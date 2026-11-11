import { apiClient } from './client';

export const accountApi = {

  /** Deletes the signed-in account for good. The password is asked again so nobody else can do it from an open phone. */
  async deleteMine(password: string) {
    await apiClient.post('/account/delete', { password });
  },
};
