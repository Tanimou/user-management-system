/**
 * Shared sorting configuration for API
 * Eliminates duplication in sorting validation
 */

export type SortOrder = 'asc' | 'desc';

/**
 * Valid sort fields for users endpoint
 */
export const VALID_SORT_FIELDS = ['name', 'email', 'createdAt', 'updatedAt'] as const;

export type ValidSortField = typeof VALID_SORT_FIELDS[number];

/**
 * Valid sort orders for API
 */
export const VALID_SORT_ORDERS: SortOrder[] = ['asc', 'desc'];

/**
 * Default sorting configuration
 */
export const DEFAULT_SORT_BY: ValidSortField = 'createdAt';
export const DEFAULT_SORT_ORDER: SortOrder = 'desc';

/**
 * Validates if a sort field is valid
 */
export function isValidSortField(field: string): field is ValidSortField {
  return VALID_SORT_FIELDS.includes(field as ValidSortField);
}

/**
 * Validates if a sort order is valid
 */
export function isValidSortOrder(order: string): order is SortOrder {
  return VALID_SORT_ORDERS.includes(order as SortOrder);
}

/**
 * Helper function to get validated sorting parameters
 */
export function getValidatedSorting(
  orderBy?: string | string[],
  order?: string | string[]
): { sortField: ValidSortField; sortOrder: SortOrder } {
  const sortByStr = Array.isArray(orderBy) ? orderBy[0] : orderBy;
  const orderStr = Array.isArray(order) ? order[0] : order;

  const sortField = isValidSortField(sortByStr || '') ? sortByStr as ValidSortField : DEFAULT_SORT_BY;
  const sortOrder = isValidSortOrder(orderStr || '') ? orderStr as SortOrder : DEFAULT_SORT_ORDER;

  return { sortField, sortOrder };
}