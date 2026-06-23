import { Elysia } from "elysia";
import { RegionController } from "./region.controller";
import { authMiddleware } from "../auth/auth.middleware";

export const regionRoutes = new Elysia({ prefix: "/api/regions" })
  .use(authMiddleware)
  .get("/provinces", RegionController.getProvinces)
  .get("/regencies", RegionController.getRegencies)
  .get("/districts", RegionController.getDistricts)
  .get("/villages", RegionController.getVillages);
