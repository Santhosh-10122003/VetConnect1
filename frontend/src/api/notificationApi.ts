import { apiClient } from './client';

export interface NotificationItem {
  id: number;
  userId: number;
  title: string;
  message: string;
  notificationType: string;
  isRead: boolean;
  referenceId?: string;
  createdAt: string;
}

export const notificationApi = {
  async getMyNotifications(page = 0, size = 20) {
    const res = await apiClient.get<{
      success: boolean;
      data: {
        content: NotificationItem[];
        totalPages: number;
        totalElements: number;
      };
    }>('/notifications', { params: { page, size } });
    return res.data;
  },

  async getRecentNotifications() {
    const res = await apiClient.get<{ success: boolean; data: NotificationItem[] }>('/notifications/recent');
    return res.data;
  },

  async getUnreadCount() {
    const res = await apiClient.get<{ success: boolean; data: { unreadCount: number } }>('/notifications/unread-count');
    return res.data;
  },

  async markAsRead(notificationId: number) {
    const res = await apiClient.patch<{ success: boolean; message: string }>(`/notifications/${notificationId}/read`);
    return res.data;
  },

  async markAllAsRead() {
    const res = await apiClient.patch<{ success: boolean; message: string }>('/notifications/read-all');
    return res.data;
  },
};
