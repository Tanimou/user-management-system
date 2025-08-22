import { describe, it, expect } from 'vitest';
import {
  VALID_SORT_FIELDS,
  VALID_SORT_ORDERS,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  isValidSortField,
  isValidSortOrder,
  getValidatedSorting,
  type SortOrder,
  type ValidSortField,
} from '../lib/sorting';

describe('API Sorting Utils', () => {
  describe('Constants', () => {
    it('should have correct valid sort fields', () => {
      expect(VALID_SORT_FIELDS).toEqual(['name', 'email', 'createdAt', 'updatedAt']);
    });

    it('should have correct valid sort orders', () => {
      expect(VALID_SORT_ORDERS).toEqual(['asc', 'desc']);
    });

    it('should have correct default values', () => {
      expect(DEFAULT_SORT_BY).toBe('createdAt');
      expect(DEFAULT_SORT_ORDER).toBe('desc');
    });
  });

  describe('isValidSortField', () => {
    it('should return true for valid sort fields', () => {
      expect(isValidSortField('name')).toBe(true);
      expect(isValidSortField('email')).toBe(true);
      expect(isValidSortField('createdAt')).toBe(true);
      expect(isValidSortField('updatedAt')).toBe(true);
    });

    it('should return false for invalid sort fields', () => {
      expect(isValidSortField('invalid')).toBe(false);
      expect(isValidSortField('id')).toBe(false);
      expect(isValidSortField('')).toBe(false);
    });
  });

  describe('isValidSortOrder', () => {
    it('should return true for valid sort orders', () => {
      expect(isValidSortOrder('asc')).toBe(true);
      expect(isValidSortOrder('desc')).toBe(true);
    });

    it('should return false for invalid sort orders', () => {
      expect(isValidSortOrder('ascending')).toBe(false);
      expect(isValidSortOrder('descending')).toBe(false);
      expect(isValidSortOrder('')).toBe(false);
    });
  });

  describe('getValidatedSorting', () => {
    it('should return valid sorting parameters', () => {
      const result = getValidatedSorting('name', 'asc');
      expect(result).toEqual({
        sortField: 'name',
        sortOrder: 'asc',
      });
    });

    it('should use defaults for undefined parameters', () => {
      const result = getValidatedSorting();
      expect(result).toEqual({
        sortField: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
      });
    });

    it('should use defaults for invalid parameters', () => {
      const result = getValidatedSorting('invalid', 'invalid');
      expect(result).toEqual({
        sortField: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
      });
    });

    it('should handle array parameters (use first element)', () => {
      const result = getValidatedSorting(['name', 'email'], ['asc', 'desc']);
      expect(result).toEqual({
        sortField: 'name',
        sortOrder: 'asc',
      });
    });

    it('should preserve valid field but use default order for invalid order', () => {
      const result = getValidatedSorting('name', 'invalid');
      expect(result).toEqual({
        sortField: 'name',
        sortOrder: DEFAULT_SORT_ORDER,
      });
    });

    it('should use default field but preserve valid order for invalid field', () => {
      const result = getValidatedSorting('invalid', 'asc');
      expect(result).toEqual({
        sortField: DEFAULT_SORT_BY,
        sortOrder: 'asc',
      });
    });

    it('should handle empty string parameters', () => {
      const result = getValidatedSorting('', '');
      expect(result).toEqual({
        sortField: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
      });
    });

    it('should handle mixed valid/invalid in arrays', () => {
      const result = getValidatedSorting(['invalid', 'name'], ['invalid', 'asc']);
      expect(result).toEqual({
        sortField: DEFAULT_SORT_BY, // First element 'invalid' is invalid
        sortOrder: DEFAULT_SORT_ORDER, // First element 'invalid' is invalid
      });
    });
  });
});