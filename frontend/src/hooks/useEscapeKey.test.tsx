import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, fireEvent } from '@testing-library/react';
import { useEscapeKey } from './useEscapeKey';

describe('useEscapeKey', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('calls the handler once on Escape', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores other keys', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler));
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('does nothing when disabled', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler, false));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('removes the keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(handler));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('only calls the top modal handler when modals are nested', () => {
    const first = vi.fn();
    const second = vi.fn();
    renderHook(() => useEscapeKey(first));
    const top = renderHook(() => useEscapeKey(second));

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();

    top.unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(first).toHaveBeenCalledTimes(1);
  });

  it('blurs a focused text input instead of closing, then closes on the next Escape', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler));
    const input = document.createElement('input');
    input.type = 'text';
    document.body.appendChild(input);
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: 'Escape' });
    expect(handler).not.toHaveBeenCalled();
    expect(document.activeElement).not.toBe(input);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('ignores events that were already handled', () => {
    const handler = vi.fn();
    renderHook(() => useEscapeKey(handler));
    const event = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    event.preventDefault();
    window.dispatchEvent(event);
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls the newest handler without re-subscribing on re-render', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = renderHook(({ fn }) => useEscapeKey(fn), { initialProps: { fn: first } });
    const addCalls = addSpy.mock.calls.length;

    rerender({ fn: second });
    expect(addSpy.mock.calls.length).toBe(addCalls);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(second).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
  });
});
