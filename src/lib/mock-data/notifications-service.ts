import { commitDb, getDb } from "./db-store";

export function markNotificationsRead(userId: string, ids?: string[]) {
  const db = getDb();
  commitDb({ ...db, notifications: db.notifications.map((n) => (n.userId === userId && (!ids || ids.includes(n.id)) ? { ...n, read: true } : n)) });
}
