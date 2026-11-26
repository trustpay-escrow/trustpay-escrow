export function getPagination(totalItems: number, page: number, pageSize: number) {
  const total = Math.max(0, Math.floor(totalItems));
  const size = Math.max(1, Math.floor(pageSize));
  const totalPages = Math.max(1, Math.ceil(total / size));
  const currentPage = Math.min(totalPages, Math.max(1, Math.floor(page)));
  const startIndex = (currentPage - 1) * size;
  const endIndex = Math.min(startIndex + size, total);

  return { page: currentPage, totalPages, startIndex, endIndex, firstItem: total === 0 ? 0 : startIndex + 1 };
}

export type PaginationItem = number | 'ellipsis';

/** Keep endpoints reachable and slide a bounded window around the current page. */
export function getPaginationItems(totalPages: number, page: number, leadingCount: number): PaginationItem[] {
  const total = Math.max(1, Math.floor(totalPages));
  const current = Math.max(1, Math.min(total, Math.floor(page)));
  const count = Math.max(3, Math.floor(leadingCount));
  const range = (first: number, last: number) =>
    Array.from({ length: Math.max(0, last - first + 1) }, (_, index) => first + index);

  // The one extra page is shown directly: 4 on mobile, 9 on desktop.
  if (total <= count + 1) return range(1, total);

  const middleCount = count - 2;
  const before = Math.floor((middleCount - 1) / 2);
  const after = middleCount - before - 1;
  if (current <= count - after) return [...range(1, count), 'ellipsis', total];
  if (current >= total - count + before + 1) {
    return [1, 'ellipsis', ...range(total - count + 1, total)];
  }
  return [1, 'ellipsis', ...range(current - before, current + after), 'ellipsis', total];
}
