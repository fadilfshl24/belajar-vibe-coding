import { Elysia, t } from "elysia";
import { StorageService } from "../../core/services/storage.service";
import { authMiddleware } from "../auth/auth.middleware";
import { successResponse, failedResponse } from "../../core/utils/response";

export const uploadRoutes = new Elysia({ prefix: "/api/upload" })
  .use(authMiddleware)
  .post(
    "/",
    async (ctx) => {
      const correlationId = (ctx.headers["x-correlation-id"] as string | undefined) ?? crypto.randomUUID();
      try {
        const file = ctx.body.file as File;
        const url = await StorageService.uploadFile(file, "pr-attachments");
        return successResponse(correlationId, "File uploaded successfully", { url });
      } catch (err: unknown) {
        ctx.set.status = 400;
        return failedResponse(correlationId, "Failed to upload file", 400, err instanceof Error ? err.message : "Unknown error");
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    }
  );
