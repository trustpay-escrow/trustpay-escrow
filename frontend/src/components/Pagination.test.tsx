import { useRef, useState } from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Pagination } from './Pagination';

const scrollIntoView = vi.fn();
let reducedMotion = false;
let compactViewport = false;
beforeEach(() => {
  scrollIntoView.mockClear();
  reducedMotion = false;
  compactViewport = false;
  Element.prototype.scrollIntoView = scrollIntoView;
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({ matches: query.includes('max-width') ? compactViewport : reducedMotion, addEventListener: vi.fn(), removeEventListener: vi.fn() })));
});

function List({ total = 48, initialPage = 1, disabled = false }) {
  const [page, setPage] = useState(initialPage);
  const [size, setSize] = useState(10);
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref}><Pagination totalItems={total} page={page} pageSize={size}
    onPageChange={setPage} onPageSizeChange={(value) => { setSize(value); setPage(1); }}
    itemLabel="projects" disabled={disabled} scrollTarget={ref} /></div>;
}

describe('Pagination', () => {
  it('updates the range, active page and boundary buttons', () => {
    render(<List />);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1-10 of 48 projects');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Page 5' }));
    expect(screen.getByRole('status')).toHaveTextContent('Showing 41-48 of 48 projects');
    expect(screen.getByRole('button', { name: 'Page 5' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('status')).toHaveTextContent('Showing 31-40 of 48 projects');
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('keeps the selector available on a single page and resets to page one', () => {
    render(<List initialPage={5} />);
    const select = screen.getByRole('combobox', { name: 'Rows per page' });
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(['10', '25', '50']);
    fireEvent.change(select, { target: { value: '25' } });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1-25 of 48 projects');
    fireEvent.change(select, { target: { value: '50' } });
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1-48 of 48 projects');
    expect(select).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('renders an honest empty range with navigation disabled', () => {
    render(<List total={0} />);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 0-0 of 0 projects');
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('bounds the button count for large datasets and keeps the final page reachable', () => {
    render(<List total={1000000} initialPage={50000} />);
    expect(screen.getAllByRole('button').length).toBeLessThanOrEqual(12);
    fireEvent.click(screen.getByRole('button', { name: 'Page 100000' }));
    expect(screen.getByRole('status')).toHaveTextContent('Showing 999991-1000000');
  });

  it('disables interaction while a page is loading', () => {
    render(<List disabled />);
    for (const button of screen.getAllByRole('button')) expect(button).toBeDisabled();
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('respects reduced motion when returning to the list', () => {
    reducedMotion = true;
    render(<List />);
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });
  it('uses three leading pages on phones and slides through hidden pages', () => {
    compactViewport = true;
    render(<List total={200} />);
    expect(screen.getAllByRole('button', { name: /^Page / }).map(b => b.textContent)).toEqual(['1', '2', '3', '20']);
    fireEvent.click(screen.getByRole('button', { name: 'Page 3' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('button', { name: 'Page 4' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('button', { name: /^Page / }).map(b => b.textContent)).toEqual(['1', '4', '20']);
    fireEvent.click(screen.getByRole('button', { name: 'Page 20' }));
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    expect(screen.getAllByRole('button', { name: /^Page / }).map(b => b.textContent)).toEqual(['1', '18', '19', '20']);
  });

  it.each([[40, false], [50, true]])('uses mobile 4/5 threshold for %i items', (total, ellipsis) => {
    compactViewport = true;
    render(<List total={total} />);
    expect(!!document.querySelector('.pagination-ellipsis')).toBe(ellipsis);
  });

  it.each([[90, false], [100, true]])('uses desktop 9/10 threshold for %i items', (total, ellipsis) => {
    render(<List total={total} />);
    expect(!!document.querySelector('.pagination-ellipsis')).toBe(ellipsis);
  });

});
