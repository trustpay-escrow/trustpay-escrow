import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import PortfolioLinkPreview, { parsePortfolioUrl } from './PortfolioLinkPreview';

describe('PortfolioLinkPreview Component & Parser', () => {
  describe('parsePortfolioUrl', () => {
    it('parses GitHub URLs correctly', () => {
      const res = parsePortfolioUrl('https://github.com/developer/portfolio');
      expect(res.platform).toBe('github');
      expect(res.displayUrl).toBe('github.com/developer/portfolio');
      expect(res.isSuspicious).toBe(false);
      expect(res.safeHref).toBe('https://github.com/developer/portfolio');
    });

    it('parses Figma URLs correctly', () => {
      const res = parsePortfolioUrl('https://www.figma.com/design/sample-project');
      expect(res.platform).toBe('figma');
      expect(res.displayUrl).toBe('figma.com/design/sample-project');
      expect(res.isSuspicious).toBe(false);
    });

    it('parses Dribbble and Behance URLs correctly', () => {
      const dribbble = parsePortfolioUrl('dribbble.com/designer');
      expect(dribbble.platform).toBe('dribbble');
      expect(dribbble.safeHref).toBe('https://dribbble.com/designer');

      const behance = parsePortfolioUrl('https://www.behance.net/portfolio');
      expect(behance.platform).toBe('behance');
    });

    it('flags javascript: or data: protocols as suspicious', () => {
      const js = parsePortfolioUrl('javascript:alert(1)');
      expect(js.isSuspicious).toBe(true);
      expect(js.platform).toBe('suspicious');

      const data = parsePortfolioUrl('data:text/html,malicious');
      expect(data.isSuspicious).toBe(true);
    });

    it('flags IP addresses as suspicious', () => {
      const ip = parsePortfolioUrl('http://192.168.1.1/exploit');
      expect(ip.isSuspicious).toBe(true);
      expect(ip.platform).toBe('suspicious');
    });
  });

  describe('Component Rendering', () => {
    it('renders safe anchor tag with rel="noopener noreferrer" and target="_blank"', () => {
      render(<PortfolioLinkPreview url="https://github.com/stellar/soroban" />);
      const link = screen.getByTestId('portfolio-link-chip');

      expect(link).toHaveAttribute('href', 'https://github.com/stellar/soroban');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
      expect(screen.getByText('github.com/stellar/soroban')).toBeInTheDocument();
    });

    it('renders warning badge for suspicious link without rendering dangerous link', () => {
      render(<PortfolioLinkPreview url="javascript:stealToken()" />);
      expect(screen.getByTestId('suspicious-link-badge')).toBeInTheDocument();
      expect(screen.getByText(/warning/i)).toBeInTheDocument();
      expect(screen.queryByTestId('portfolio-link-chip')).not.toBeInTheDocument();
    });
  });
});
