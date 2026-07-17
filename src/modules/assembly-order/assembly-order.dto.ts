import type { CreateAssemblyOrderInput } from "./assembly-order.validation";

export interface ICreateAssemblyOrder extends CreateAssemblyOrderInput {}

export interface IAssemblyOrderQueryFilters {
  page: number;
  limit: number;
  orderBy: string;
  searchTerm?: string;
  filterColumn?: string;
  status?: number;
  warehouseId?: string;
  warehouseIds?: string[]; // for role-based warehouse visibility
  requiredApprovalStage?: number; // for dynamic approval filtering
}
