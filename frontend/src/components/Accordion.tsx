'use client';

import React, { useState, useId } from 'react';

export interface AccordionItemData {
  id?: string;
  title: React.ReactNode;
  content: React.ReactNode;
  disabled?: boolean;
}

export interface AccordionProps {
  items: AccordionItemData[];
  type?: 'single' | 'multiple';
  defaultOpen?: string | string[];
  className?: string;
  itemClassName?: string;
}

export function Accordion({
  items,
  type = 'single',
  defaultOpen,
  className = 'space-y-4',
  itemClassName = '',
}: AccordionProps) {
  const baseId = useId();

  const [openItems, setOpenItems] = useState<string[]>(() => {
    if (!defaultOpen) return [];
    return Array.isArray(defaultOpen) ? defaultOpen : [defaultOpen];
  });

  const toggleItem = (itemId: string) => {
    setOpenItems((prev) => {
      if (type === 'single') {
        return prev.includes(itemId) ? [] : [itemId];
      } else {
        return prev.includes(itemId)
          ? prev.filter((id) => id !== itemId)
          : [...prev, itemId];
      }
    });
  };

  return (
    <div className={className} data-testid="accordion">
      {items.map((item, idx) => {
        const itemId = item.id || `item-${idx}`;
        const headerId = `${baseId}-header-${itemId}`;
        const panelId = `${baseId}-panel-${itemId}`;
        const isOpen = openItems.includes(itemId);

        return (
          <div
            key={itemId}
            className={`bg-[#18181b]/80 border border-[#27272a] rounded-2xl overflow-hidden transition-colors ${itemClassName}`}
            data-testid={`accordion-item-${itemId}`}
          >
            <h3>
              <button
                type="button"
                id={headerId}
                aria-expanded={isOpen}
                aria-controls={panelId}
                disabled={item.disabled}
                onClick={() => toggleItem(itemId)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleItem(itemId);
                  }
                }}
                className="w-full px-6 py-5 flex items-center justify-between text-left font-bold text-white hover:text-blue-400 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group"
                data-testid={`accordion-trigger-${itemId}`}
              >
                <span className="text-sm sm:text-base pr-4">{item.title}</span>
                <span
                  className="text-xl text-[#71717a] group-hover:text-white transition-transform duration-300"
                  style={{
                    transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  }}
                  aria-hidden="true"
                >
                  +
                </span>
              </button>
            </h3>

            {/* Smooth CSS Grid Height Animation (0fr -> 1fr) */}
            <div
              id={panelId}
              role="region"
              aria-labelledby={headerId}
              className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
              data-testid={`accordion-content-${itemId}`}
            >
              <div className="overflow-hidden">
                <div className="px-6 pb-5 text-xs sm:text-sm text-[#a1a1aa] leading-relaxed border-t border-[#27272a]/40 pt-4">
                  {item.content}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default Accordion;
