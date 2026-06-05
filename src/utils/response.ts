export interface PaginationMeta {
  page: number;
  limit: number;
  totalRecord: number;
  totalPage: number;
  nextPage: boolean;
  previousPage: boolean;
  nextPageURL: string;
  previousPageURL: string;
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
  correlationId: string,
  message: string,
  data: T,
  pagination?: PaginationMeta
): StandardResponse<T> {
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
}

export function failedResponse(
  correlationId: string,
  message: string,
  code: 400 | 401 | 500,
  exceptionMessage?: string
): StandardResponse<null> {
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
