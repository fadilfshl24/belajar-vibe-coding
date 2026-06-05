import { Elysia } from "elysia";
import { apiRoutes } from "./routes/apiRoutes";

const app = new Elysia()
  .use(apiRoutes)
  .get("/health", () => ({ status: "ok" }))
  .listen(3000);

console.log(
  `🦊 Server running at http://${app.server?.hostname}:${app.server?.port}`
);
