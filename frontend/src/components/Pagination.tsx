'use client';

import { useId, useSyncExternalStore, type RefObject } from 'react';
import { getPagination, getPaginationItems } from '@/lib/pagination';

const compactQuery = '(max-width: 767px)';
const getCompactSnapshot = () => window.matchMedia(compactQuery).matches;
const getServerSnapshot = () => false;
function subscribeToCompact(callback: () => void) {
  const query = window.matchMedia(compactQuery);
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}

interface PaginationProps {
  totalItems: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  itemLabel?: string;
  disabled?: boolean;
  scrollTarget?: RefObject<HTMLElement | null>;
}

export function Pagination({
  totalItems, page, pageSize, onPageChange, onPageSizeChange,
  itemLabel = 'items', disabled = false, scrollTarget,
}: PaginationProps) {
  const selectId = useId();
  const { page: currentPage, totalPages, firstItem, endIndex } = getPagination(totalItems, page, pageSize);
  const compact = useSyncExternalStore(subscribeToCompact, getCompactSnapshot, getServerSnapshot);
  const pages = getPaginationItems(totalPages, currentPage, compact ? 3 : 8);

  const scrollToList = () => scrollTarget?.current?.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
    block: 'start',
  });
  const goToPage = (nextPage: number) => {
    if (nextPage === currentPage) return;
    onPageChange(nextPage);
    scrollToList();
  };
  const buttonClass = 'pagination-button min-h-10 min-w-10 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <nav aria-label={itemLabel + ' pagination'} className="trustpay-pagination flex flex-col gap-3 border-t border-[#27272a] pt-4">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[#a1a1aa]">
        <p role="status" aria-live="polite">Showing {firstItem}-{endIndex} of {totalItems} {itemLabel}</p>
        <label htmlFor={selectId} className="flex items-center gap-2">
          Rows per page
          <select
            id={selectId}
            value={pageSize}
            disabled={disabled}
            onChange={(event) => {
              onPageSizeChange(Number(event.target.value));
              scrollToList();
            }}
            className="min-h-10 rounded-lg border border-[#333338] bg-[#232326] px-2 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          >
            {[10, 25, 50].map((size) => <option key={size} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="pagination-controls">
        <button type="button" aria-label="Previous" disabled={disabled || currentPage === 1} onClick={() => goToPage(currentPage - 1)} className={buttonClass + ' border-[#333338] bg-[#232326] text-[#e4e4e7]'}>
          <span className="pagination-label">Previous</span><span className="pagination-icon" aria-hidden="true">‹</span>
        </button>
        {pages.map((item, index) => item === 'ellipsis' ? (
          <span key={'ellipsis-' + index} aria-hidden="true" className="pagination-ellipsis text-[#a1a1aa]">…</span>
        ) : (
          <button
            key={item}
            data-long-number={item >= 10000 ? '' : undefined}
            type="button"
            aria-label={'Page ' + item}
            aria-current={item === currentPage ? 'page' : undefined}
            disabled={disabled}
            onClick={() => goToPage(item)}
            className={buttonClass + (item === currentPage ? ' border-indigo-500 bg-indigo-600 text-white' : ' border-[#333338] bg-[#232326] text-[#a1a1aa]')}
          >{item}</button>
        ))}
        <button type="button" aria-label="Next" disabled={disabled || currentPage === totalPages} onClick={() => goToPage(currentPage + 1)} className={buttonClass + ' border-[#333338] bg-[#232326] text-[#e4e4e7]'}>
          <span className="pagination-label">Next</span><span className="pagination-icon" aria-hidden="true">›</span>
        </button>
      </div>
    </nav>
  );
}
