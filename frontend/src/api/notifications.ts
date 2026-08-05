import { authFetch } from "./client";
import type { NotificationsOut } from "../types/notification";

export function getNotifications(token: string): Promise<NotificationsOut> {
  return authFetch<NotificationsOut>(token, "/api/notifications");
}
