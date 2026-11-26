import { describe, expect, it } from 'vitest';
import { getPagination, getPaginationItems } from './pagination';

describe('pagination ranges', () => {
  it.each([
    [48, 1, 10, 5, 0, 10, 1],
    [48, 5, 10, 5, 40, 48, 41],
    [48, 2, 25, 2, 25, 48, 26],
    [48, 1, 50, 1, 0, 48, 1],
    [0, 9, 10, 1, 0, 0, 0],
    [20, 2, 10, 2, 10, 20, 11],
    [48, -2, 10, 5, 0, 10, 1],
    [12, 50, 10, 2, 10, 12, 11],
  ])('clamps %i items, page %i, size %i', (total, page, size, pages, start, end, first) => {
    expect(getPagination(total, page, size)).toEqual({
      page: Math.max(1, Math.min(page, pages)), totalPages: pages,
      startIndex: start, endIndex: end, firstItem: first,
    });
    expect(Array.from({ length: total }).slice(start, end)).toHaveLength(end - start);
  });
});

describe('responsive page-number windows', () => {
  it.each([
    [4, 1, 3, [1, 2, 3, 4]],
    [5, 1, 3, [1, 2, 3, 'ellipsis', 5]],
    [9, 1, 8, [1, 2, 3, 4, 5, 6, 7, 8, 9]],
    [10, 1, 8, [1, 2, 3, 4, 5, 6, 7, 8, 'ellipsis', 10]],
    [20, 1, 3, [1, 2, 3, 'ellipsis', 20]],
    [20, 10, 3, [1, 'ellipsis', 10, 'ellipsis', 20]],
    [20, 20, 3, [1, 'ellipsis', 18, 19, 20]],
    [20, 10, 8, [1, 'ellipsis', 8, 9, 10, 11, 12, 13, 'ellipsis', 20]],
    [20, 20, 8, [1, 'ellipsis', 13, 14, 15, 16, 17, 18, 19, 20]],
  ])('uses requested window for total=%i page=%i leading=%i', (total, page, count, expected) => {
    expect(getPaginationItems(total, page, count)).toEqual(expected);
  });

  it.each([3, 8])('keeps endpoints/current page within %i + 2 slots', (count) => {
    for (const total of [1, 4, 5, 9, 10, 20, 100, 100000]) {
      for (const page of [1, 2, 3, 4, 5, Math.ceil(total / 2), total - 1, total].filter(p => p > 0 && p <= total)) {
        const items = getPaginationItems(total, page, count);
        const numbers = items.filter((item): item is number => typeof item === 'number');
        expect(numbers).toContain(page);
        expect(numbers[0]).toBe(1);
        expect(numbers[numbers.length - 1]).toBe(total);
        expect(numbers).toEqual([...new Set(numbers)].sort((a, b) => a - b));
        expect(items.length).toBeLessThanOrEqual(count + 2);
        expect(items[0]).not.toBe('ellipsis');
        expect(items[items.length - 1]).not.toBe('ellipsis');
      }
    }
  });
});
