import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));

import Home from './page';

describe('Landing Page Hero CTA Component (#262)', () => {
  it('renders the primary Create Escrow hero CTA with link to /projects/create', () => {
    render(<Home />);
    const ctaButton = screen.getByTestId('hero-create-escrow-cta');
    expect(ctaButton).toBeInTheDocument();
    expect(ctaButton).toHaveAttribute('href', '/projects/create');
    expect(ctaButton).toHaveTextContent('Create Escrow');
  });

  it('renders the ambient radial pulse glow element with animate-hero-glow class', () => {
    render(<Home />);
    const ctaButton = screen.getByTestId('hero-create-escrow-cta');
    const glowWrapper = ctaButton.parentElement;
    expect(glowWrapper).toBeInTheDocument();
    
    const glowRing = glowWrapper?.querySelector('.animate-hero-glow');
    expect(glowRing).toBeInTheDocument();
    expect(glowRing).toHaveAttribute('aria-hidden', 'true');
    expect(glowRing?.className).toContain('bg-gradient-to-r');
  });

  it('renders auxiliary action links for navigation and documentation', () => {
    render(<Home />);
    expect(screen.getByText(/Explore Projects Portal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/How It Works/i).length).toBeGreaterThanOrEqual(1);
  });
});
