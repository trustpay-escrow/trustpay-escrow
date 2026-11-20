'use client';

import { useEffect, useRef } from 'react';

type EscapeHandler = () => void;

// Open modals, oldest first. Only the last one reacts to Escape,
// so a lightbox opened on top of a form closes alone.
const handlerStack: Array<{ current: EscapeHandler }> = [];

const NON_TEXT_INPUT_TYPES = new Set([
  'button', 'checkbox', 'color', 'file', 'image', 'radio', 'range', 'reset', 'submit',
]);

function isTypingTarget(target: EventTarget | null): target is HTMLElement {
  if (!(target instanceof HTMLElement)) return false;
  if (target instanceof HTMLInputElement) return !NON_TEXT_INPUT_TYPES.has(target.type);
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    target.isContentEditable === true
  );
}

function handleKeyDown(event: KeyboardEvent) {
  if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
  const top = handlerStack[handlerStack.length - 1];
  if (!top) return;
  if (isTypingTarget(event.target)) {
    // The user is typing: leave the modal open, release the field.
    event.target.blur();
    return;
  }
  top.current();
}

export function useEscapeKey(onEscape: EscapeHandler, enabled = true) {
  const handlerRef = useRef(onEscape);

  useEffect(() => {
    handlerRef.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return;
    handlerStack.push(handlerRef);
    if (handlerStack.length === 1) window.addEventListener('keydown', handleKeyDown);
    return () => {
      const index = handlerStack.lastIndexOf(handlerRef);
      if (index !== -1) handlerStack.splice(index, 1);
      if (handlerStack.length === 0) window.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled]);
}
