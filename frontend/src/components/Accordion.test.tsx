import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import Accordion from './Accordion';

describe('Accordion Component', () => {
  const sampleItems = [
    { id: 'faq-1', title: 'What is TrustPay?', content: 'TrustPay is a decentralized escrow.' },
    { id: 'faq-2', title: 'How does milestone locking work?', content: 'Funds are locked into Soroban contracts.' },
  ];

  it('renders accordion items collapsed by default', () => {
    render(<Accordion items={sampleItems} />);
    const trigger1 = screen.getByTestId('accordion-trigger-faq-1');
    const trigger2 = screen.getByTestId('accordion-trigger-faq-2');

    expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');

    const content1 = screen.getByTestId('accordion-content-faq-1');
    expect(content1).toHaveClass('grid-rows-[0fr]');
  });

  it('expands item on click and updates aria-expanded to true', () => {
    render(<Accordion items={sampleItems} />);
    const trigger1 = screen.getByTestId('accordion-trigger-faq-1');

    fireEvent.click(trigger1);
    expect(trigger1).toHaveAttribute('aria-expanded', 'true');

    const content1 = screen.getByTestId('accordion-content-faq-1');
    expect(content1).toHaveClass('grid-rows-[1fr]');
  });

  it('supports keyboard accessibility: Enter and Space keys toggle expansion', () => {
    render(<Accordion items={sampleItems} />);
    const trigger1 = screen.getByTestId('accordion-trigger-faq-1');

    // Press Enter to open
    fireEvent.keyDown(trigger1, { key: 'Enter', code: 'Enter' });
    expect(trigger1).toHaveAttribute('aria-expanded', 'true');

    // Press Space to close
    fireEvent.keyDown(trigger1, { key: ' ', code: 'Space' });
    expect(trigger1).toHaveAttribute('aria-expanded', 'false');
  });

  it('enforces single-open mode by closing previous item when new item is opened', () => {
    render(<Accordion items={sampleItems} type="single" />);
    const trigger1 = screen.getByTestId('accordion-trigger-faq-1');
    const trigger2 = screen.getByTestId('accordion-trigger-faq-2');

    fireEvent.click(trigger1);
    expect(trigger1).toHaveAttribute('aria-expanded', 'true');
    expect(trigger2).toHaveAttribute('aria-expanded', 'false');

    // Click item 2; item 1 should collapse
    fireEvent.click(trigger2);
    expect(trigger1).toHaveAttribute('aria-expanded', 'false');
    expect(trigger2).toHaveAttribute('aria-expanded', 'true');
  });

  it('supports multi-open mode when configured', () => {
    render(<Accordion items={sampleItems} type="multiple" />);
    const trigger1 = screen.getByTestId('accordion-trigger-faq-1');
    const trigger2 = screen.getByTestId('accordion-trigger-faq-2');

    fireEvent.click(trigger1);
    fireEvent.click(trigger2);

    expect(trigger1).toHaveAttribute('aria-expanded', 'true');
    expect(trigger2).toHaveAttribute('aria-expanded', 'true');
  });
});
