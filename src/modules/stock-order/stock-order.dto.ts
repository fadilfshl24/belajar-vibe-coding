import type { StockOrderRecord, StockOrderItemRecord } from "./stock-order.schema";
import type { WarehouseRecord } from "../warehouse/warehouse.schema";

export interface IStockOrderItem extends StockOrderItemRecord {
  item?: {
    id: string;
    code: string;
    name: string;
  };
}

export interface IStockOrder extends StockOrderRecord {
  warehouse?: WarehouseRecord;
  items?: IStockOrderItem[];
}
