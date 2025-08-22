import { describe, it, expect } from 'vitest';
import {
  VALID_SORT_FIELDS,
  VALID_SORT_ORDERS,
  DEFAULT_SORT_BY,
  DEFAULT_SORT_ORDER,
  toNaiveSortOrder,
  fromNaiveSortOrder,
  getColumnSortOrder,
  isValidSortField,
  isValidSortOrder,
  setSorting,
  type SortOrder,
  type ValidSortField,
  type NaiveSortOrder,
} from '../src/utils/sorting';

describe('Sorting Utils', () => {
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

  describe('toNaiveSortOrder', () => {
    it('should convert asc to ascend', () => {
      expect(toNaiveSortOrder('asc')).toBe('ascend');
    });

    it('should convert desc to descend', () => {
      expect(toNaiveSortOrder('desc')).toBe('descend');
    });
  });

  describe('fromNaiveSortOrder', () => {
    it('should convert ascend to asc', () => {
      expect(fromNaiveSortOrder('ascend')).toBe('asc');
    });

    it('should convert descend to desc', () => {
      expect(fromNaiveSortOrder('descend')).toBe('desc');
    });
  });

  describe('getColumnSortOrder', () => {
    it('should return correct sort order for active column', () => {
      expect(getColumnSortOrder('name', 'name', 'asc')).toBe('ascend');
      expect(getColumnSortOrder('email', 'email', 'desc')).toBe('descend');
    });

    it('should return false for inactive column', () => {
      expect(getColumnSortOrder('name', 'email', 'asc')).toBe(false);
      expect(getColumnSortOrder('createdAt', 'name', 'desc')).toBe(false);
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

  describe('setSorting', () => {
    it('should set valid sorting parameters', () => {
      const params = {};
      setSorting(params, 'name', 'asc');
      expect(params).toEqual({
        sortBy: 'name',
        sortOrder: 'asc',
      });
    });

    it('should use defaults for invalid parameters', () => {
      const params = {};
      setSorting(params, 'invalid', 'invalid');
      expect(params).toEqual({
        sortBy: DEFAULT_SORT_BY,
        sortOrder: DEFAULT_SORT_ORDER,
      });
    });

    it('should use custom defaults', () => {
      const params = {};
      setSorting(params, 'invalid', 'invalid', 'name', 'asc');
      expect(params).toEqual({
        sortBy: 'name',
        sortOrder: 'asc',
      });
    });

    it('should preserve valid field but use default order for invalid order', () => {
      const params = {};
      setSorting(params, 'name', 'invalid');
      expect(params).toEqual({
        sortBy: 'name',
        sortOrder: DEFAULT_SORT_ORDER,
      });
    });

    it('should use default field but preserve valid order for invalid field', () => {
      const params = {};
      setSorting(params, 'invalid', 'asc');
      expect(params).toEqual({
        sortBy: DEFAULT_SORT_BY,
        sortOrder: 'asc',
      });
    });
  });
});