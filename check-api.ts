import { DashboardController } from "./src/modules/dashboard/dashboard.controller";
import type { Context } from "elysia";

async function main() {
  const ctx = {
    headers: {},
    set: {},
  } as unknown as Context;

  const res = await DashboardController.getKpi(ctx);
  console.log(JSON.stringify(res, null, 2));
  process.exit(0);
}

main();
