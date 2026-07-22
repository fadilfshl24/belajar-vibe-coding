import { Elysia } from "elysia";
import { goodsReceiptController } from "./goods-receipt.controller";

export const goodsReceiptRoutes = new Elysia({ prefix: "/api/goods-receipts" }).use(goodsReceiptController);
