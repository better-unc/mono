import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useApi } from "./context";

export function useNotifications(options?: { limit?: number; offset?: number; unreadOnly?: boolean }) {
  const api = useApi();
  const { limit = 20, offset = 0, unreadOnly = false } = options || {};

  return useQuery({
    queryKey: ["notifications", limit, offset, unreadOnly],
    queryFn: () => api.notifications.list({ limit, offset, unreadOnly }),
  });
}

export function useUnreadNotificationCount() {
  const api = useApi();

  return useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => api.notifications.getUnreadCount(),
    refetchInterval: 30000,
  });
}

export function useMarkNotificationRead() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.notifications.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.notifications.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export function useDeleteNotification() {
  const api = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.notifications.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}
