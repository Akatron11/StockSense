import { authFetch } from "./client";
import type { NotificationReadIn, NotificationsOut } from "../types/notification";

export function getNotifications(token: string): Promise<NotificationsOut> {
  return authFetch<NotificationsOut>(token, "/api/notifications");
}

export function markNotificationRead(token: string, payload: NotificationReadIn): Promise<void> {
  return authFetch<void>(token, "/api/notifications/read", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
