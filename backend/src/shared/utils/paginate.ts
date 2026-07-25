/**
 * Pagination utility
 *
 * WHY: Every list endpoint needs pagination. Centralizing this logic
 * prevents inconsistencies across endpoints (different default sizes,
 * missing total counts, etc.).
 *
 * DESIGN: Returns Prisma-compatible `skip`/`take` plus metadata
 * that matches our standard paginated response envelope.
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResponse<T> {
  success: true;
  data: T[];
  meta: PaginationMeta;
}

export const parsePagination = (query: {
  page?: string | number;
  limit?: string | number;
}): PaginationParams => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  return { page, limit };
};

export const getPrismaSkipTake = (params: PaginationParams) => ({
  skip: (params.page - 1) * params.limit,
  take: params.limit,
});

export const buildPaginationMeta = (
  total: number,
  params: PaginationParams
): PaginationMeta => ({
  total,
  page: params.page,
  limit: params.limit,
  totalPages: Math.ceil(total / params.limit),
  hasNextPage: params.page < Math.ceil(total / params.limit),
  hasPrevPage: params.page > 1,
});

export const paginate = <T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> => ({
  success: true,
  data,
  meta: buildPaginationMeta(total, params),
});
