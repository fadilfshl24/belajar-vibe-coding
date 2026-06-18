import { app } from "./app";

/**
 * Entry Point
 *
 * Hanya bertugas menjalankan server. Semua konfigurasi ada di app.ts.
 */
app.listen(process.env.PORT ? parseInt(process.env.PORT) : 3000);

console.log(
  `🦊 WMS Server running at http://${app.server?.hostname}:${app.server?.port}`
);
