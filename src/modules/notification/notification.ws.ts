/**
 * NotificationWebSocket
 *
 * Bun/Elysia native WebSocket server untuk real-time notification.
 * Namespace: /notifications (via query param ?namespace=notifications)
 *
 * Clients terhubung dengan: ws://localhost:3000/ws/notifications?token=<JWT>
 *
 * Event yang di-emit ke client (JSON):
 * - { event: "pr_notification", data: { ... } }
 * - { event: "qp_notification", data: { ... } }
 * - { event: "po_notification", data: { ... } }
 * - { event: "gr_notification", data: { ... } }
 * - { event: "qc_notification", data: { ... } }
 */

import type { NotificationSourceType } from "./notification.schema";

// Map userId -> Set of WebSocket connections
const connections = new Map<string, Set<any>>();

export const notificationWs = {
  /**
   * Daftarkan koneksi WebSocket untuk user tertentu.
   */
  addConnection(userId: string, ws: any) {
    if (!connections.has(userId)) {
      connections.set(userId, new Set());
    }
    connections.get(userId)!.add(ws);
  },

  /**
   * Hapus koneksi WebSocket user tertentu.
   */
  removeConnection(userId: string, ws: any) {
    const userSockets = connections.get(userId);
    if (userSockets) {
      userSockets.delete(ws);
      if (userSockets.size === 0) {
        connections.delete(userId);
      }
    }
  },

  /**
   * Kirim notifikasi ke satu user spesifik.
   */
  emitToUser(
    userId: string,
    sourceType: NotificationSourceType,
    payload: object
  ) {
    const eventName = `${sourceType.toLowerCase()}_notification`;
    const message = JSON.stringify({ event: eventName, data: payload });

    const userSockets = connections.get(userId);
    if (userSockets) {
      for (const ws of userSockets) {
        try {
          ws.send(message);
        } catch {
          // Socket might be closed, ignore
        }
      }
    }
  },

  /**
   * Kirim notifikasi ke semua user dalam daftar userIds.
   */
  emitToUsers(
    userIds: string[],
    sourceType: NotificationSourceType,
    payload: object
  ) {
    for (const userId of userIds) {
      this.emitToUser(userId, sourceType, payload);
    }
  },

  /**
   * Broadcast ke semua koneksi aktif.
   */
  broadcast(sourceType: NotificationSourceType, payload: object) {
    const eventName = `${sourceType.toLowerCase()}_notification`;
    const message = JSON.stringify({ event: eventName, data: payload });

    for (const [, userSockets] of connections) {
      for (const ws of userSockets) {
        try {
          ws.send(message);
        } catch {
          // ignore
        }
      }
    }
  },
};
