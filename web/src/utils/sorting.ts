/**
 * Shared sorting configuration and utilities
 * Eliminates duplication between API validation and frontend column definitions
 */

export type SortOrder = 'asc' | 'desc';
export type NaiveSortOrder = 'ascend' | 'descend' | false;

/**
 * Valid sort fields shared between frontend and backend
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
 * Converts API sort order to Naive UI sort order format
 */
export function toNaiveSortOrder(sortOrder: SortOrder): 'ascend' | 'descend' {
  return sortOrder === 'asc' ? 'ascend' : 'descend';
}

/**
 * Converts Naive UI sort order to API format
 */
export function fromNaiveSortOrder(naiveOrder: 'ascend' | 'descend'): SortOrder {
  return naiveOrder === 'ascend' ? 'asc' : 'desc';
}

/**
 * Gets the sort order for a column in Naive UI table format
 * Returns 'ascend'|'descend' if the column is currently sorted, false otherwise
 */
export function getColumnSortOrder(
  columnKey: string,
  currentSortBy: string,
  currentSortOrder: SortOrder
): NaiveSortOrder {
  if (columnKey === currentSortBy) {
    return toNaiveSortOrder(currentSortOrder);
  }
  return false;
}

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
 * Helper function to set sorting parameters with validation
 */
export function setSorting(
  params: Record<string, any>,
  sortBy: string,
  sortOrder: SortOrder,
  defaultSortBy: ValidSortField = DEFAULT_SORT_BY,
  defaultSortOrder: SortOrder = DEFAULT_SORT_ORDER
) {
  params.sortBy = isValidSortField(sortBy) ? sortBy : defaultSortBy;
  params.sortOrder = isValidSortOrder(sortOrder) ? sortOrder : defaultSortOrder;
}