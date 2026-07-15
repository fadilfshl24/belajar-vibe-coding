import { Elysia } from "elysia";
import { NotificationController } from "./notification.controller";
import { authMiddleware } from "../auth/auth.middleware";
import { notificationWs } from "./notification.ws";
import { SessionModel } from "../auth/auth.model";

/**
 * Notification Routes
 *
 * REST API endpoints for notification management.
 * WebSocket endpoint: GET /ws/notifications (upgrade to WS)
 */
export const notificationRoutes = new Elysia({ prefix: "/api/notifications" })
  .use(authMiddleware)
  .get("/", NotificationController.getAll)
  .get("/recent", NotificationController.getRecent)
  .get("/unread-count", NotificationController.getUnreadCount)
  .put("/read-all", NotificationController.markAllRead)
  .put("/:id/read", NotificationController.markRead)
  .delete("/:id", NotificationController.deleteOne);

/**
 * WebSocket Route for real-time notifications.
 *
 * Connect with: ws://localhost:3000/ws/notifications
 * Auth: send accessToken cookie or pass it as query param: ?token=<JWT>
 *
 * On connect:
 *   Server validates token, registers connection, emits { event: "connected" }
 *
 * On message from client:
 *   { event: "ping" } → server responds { event: "pong" }
 *
 * On disconnect:
 *   Server removes connection from the pool
 */
export const notificationWsRoutes = new Elysia()
  .ws("/ws/notifications", {
    async open(ws) {
      try {
        // Extract token from request URL safely
        const urlObj = new URL(ws.data.request.url, "http://localhost");
        const token = urlObj.searchParams.get("token") || (ws.data as any)?.query?.token;

        if (!token) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Unauthorized: no token" } }));
          ws.close();
          return;
        }

        // Validate token
        const session = await SessionModel.validateSession(token);
        if (!session) {
          ws.send(JSON.stringify({ event: "error", data: { message: "Unauthorized: invalid token" } }));
          ws.close();
          return;
        }

        const userId = session.userId;
        // Store userId on the ws context for cleanup on close
        (ws.data as any).userId = userId;

        notificationWs.addConnection(userId, ws);
        ws.send(JSON.stringify({ event: "connected", data: { userId, message: "Connected to notification service" } }));

        console.log(`[WS:notifications] User ${userId} connected`);
      } catch (err) {
        ws.send(JSON.stringify({ event: "error", data: { message: "Connection failed" } }));
        ws.close();
      }
    },

    message(ws, message) {
      try {
        const parsed = typeof message === "string" ? JSON.parse(message) : message;
        if (parsed?.event === "ping") {
          ws.send(JSON.stringify({ event: "pong" }));
        }
      } catch {
        // ignore malformed messages
      }
    },

    close(ws) {
      const userId = (ws.data as any).userId as string | undefined;
      if (userId) {
        notificationWs.removeConnection(userId, ws);
        console.log(`[WS:notifications] User ${userId} disconnected`);
      }
    },
  });
