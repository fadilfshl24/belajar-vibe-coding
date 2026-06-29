import { sendErrorToDiscord } from "./discordLogger";

export interface PaginationMeta {
  page: number;
  limit: number;
  totalRecord: number;
  totalPage: number;
  nextPage: boolean;
  previousPage: boolean;
  nextPageURL: string;
  previousPageURL: string;
  filterColumn: string;
  searchTerm: string;
  orderBy: string;
}

export interface ResponseMeta {
  correlationId: string;
  status: boolean;
  code: number;
  message: string;
  exceptionMessage: string;
  pagination?: PaginationMeta;
}

export interface StandardResponse<T = unknown> {
  meta: ResponseMeta;
  data: T | null;
}

export function successResponse<T>(
  data: T,
  message?: string
): StandardResponse<T>;
export function successResponse<T>(
  correlationId: string,
  message: string,
  data: T,
  pagination?: PaginationMeta
): StandardResponse<T>;
export function successResponse<T>(
  arg1: any,
  arg2?: any,
  arg3?: any,
  arg4?: any
): StandardResponse<T> {
  if (arguments.length >= 3 && typeof arg1 === "string") {
    const correlationId = arg1 as string;
    const message = arg2 as string;
    const data = arg3 as T;
    const pagination = arg4 as PaginationMeta | undefined;
    return {
      meta: {
        correlationId,
        status: true,
        code: 200,
        message,
        exceptionMessage: "",
        ...(pagination ? { pagination } : {}),
      },
      data,
    };
  } else {
    const data = arg1 as T;
    const message = (arg2 as string | undefined) ?? "Success";
    return {
      meta: {
        correlationId: crypto.randomUUID(),
        status: true,
        code: 200,
        message,
        exceptionMessage: "",
      },
      data,
    };
  }
}

export function errorResponse(message: string, error?: any): StandardResponse<null> {
  let exceptionMessage = "";
  if (error) {
    if (typeof error === "string") {
      exceptionMessage = error;
    } else if (error instanceof Error) {
      exceptionMessage = error.message;
    } else {
      try {
        exceptionMessage = JSON.stringify(error);
      } catch (e) {
        exceptionMessage = "Unknown error";
      }
    }
  }

  return {
    meta: {
      correlationId: crypto.randomUUID(),
      status: false,
      code: 400,
      message,
      exceptionMessage,
    },
    data: null,
  };
}

export function paginatedResponse<T>(
  data: T[],
  options: { page: number; limit: number; totalRecord: number }
): StandardResponse<T[]> {
  const { page, limit, totalRecord } = options;
  const totalPage = Math.ceil(totalRecord / limit) || 1;
  const pagination: PaginationMeta = {
    page,
    limit,
    totalRecord,
    totalPage,
    nextPage: page < totalPage,
    previousPage: page > 1,
    nextPageURL: "",
    previousPageURL: "",
    filterColumn: "",
    searchTerm: "",
    orderBy: "",
  };

  return {
    meta: {
      correlationId: crypto.randomUUID(),
      status: true,
      code: 200,
      message: "Success",
      exceptionMessage: "",
      pagination,
    },
    data,
  };
}

export function failedResponse(
  correlationId: string,
  message: string,
  code: 400 | 401 | 403 | 404 | 500,
  exceptionMessage?: string
): StandardResponse<null> {
  if (code === 500) {
    const errorMsg = exceptionMessage || message || "Internal Server Error";
    sendErrorToDiscord(new Error(errorMsg), { correlationId }).catch((err) => {
      console.error("[response.ts] Failed to dispatch Discord log async:", err);
    });
  }

  return {
    meta: {
      correlationId,
      status: false,
      code,
      message,
      exceptionMessage: exceptionMessage ?? "",
    },
    data: null,
  };
}
