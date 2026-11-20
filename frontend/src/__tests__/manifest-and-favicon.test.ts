import { describe, it, expect, vi } from 'vitest';

vi.mock('next/font/google', () => ({
  Geist: () => ({ variable: '--font-geist-sans' }),
  Geist_Mono: () => ({ variable: '--font-geist-mono' }),
}));

import fs from 'fs';
import path from 'path';
import { metadata, viewport } from '@/app/layout';

describe('Favicon & Web App Manifest Icons Refresh (Issue #191)', () => {
  const publicDir = path.resolve(import.meta.dirname, '../../public');
  const appDir = path.resolve(import.meta.dirname, '../app');

  describe('Manifest configuration', () => {
    it('validates manifest.json exists in frontend/public', () => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      expect(fs.existsSync(manifestPath)).toBe(true);
    });

    it('validates manifest.json contains official TrustPay branding, colors, and icons', () => {
      const manifestPath = path.join(publicDir, 'manifest.json');
      const manifestContent = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));

      // Acceptance Criteria: app name 'TrustPay Escrow' and theme_color '#09090b'
      expect(manifestContent.name).toBe('TrustPay Escrow');
      expect(manifestContent.short_name).toBe('TrustPay');
      expect(manifestContent.theme_color).toBe('#09090b');
      expect(manifestContent.background_color).toBe('#09090b');
      expect(manifestContent.display).toBe('standalone');

      // Check required icon resolutions
      const iconSizes = manifestContent.icons.map((i: any) => i.sizes);
      expect(iconSizes).toContain('16x16');
      expect(iconSizes).toContain('32x32');
      expect(iconSizes).toContain('180x180');
      expect(iconSizes).toContain('192x192');
      expect(iconSizes).toContain('512x512');
    });
  });

  describe('Icon assets validation', () => {
    it('verifies favicon.ico exists with valid ICO header in both public and app', () => {
      const publicFavicon = path.join(publicDir, 'favicon.ico');
      const appFavicon = path.join(appDir, 'favicon.ico');

      expect(fs.existsSync(publicFavicon)).toBe(true);
      expect(fs.existsSync(appFavicon)).toBe(true);

      const buf = fs.readFileSync(publicFavicon);
      expect(buf.length).toBeGreaterThan(0);
      // ICO header magic: 0x0000 0x0001
      expect(buf[0]).toBe(0);
      expect(buf[1]).toBe(0);
      expect(buf[2]).toBe(1);
      expect(buf[3]).toBe(0);
    });

    it('verifies apple-touch-icon.png exists with valid PNG signature', () => {
      const appleTouchIcon = path.join(publicDir, 'apple-touch-icon.png');
      expect(fs.existsSync(appleTouchIcon)).toBe(true);

      const buf = fs.readFileSync(appleTouchIcon);
      expect(buf.length).toBeGreaterThan(0);
      // PNG magic bytes: 0x89 'P' 'N' 'G'
      expect(buf[0]).toBe(0x89);
      expect(buf[1]).toBe(0x50);
      expect(buf[2]).toBe(0x4e);
      expect(buf[3]).toBe(0x47);
    });

    it('verifies crisp PNG icons exist for 16x16, 32x32, 192x192, and 512x512', () => {
      const files = ['favicon-16x16.png', 'favicon-32x32.png', 'icon-192x192.png', 'icon-512x512.png'];

      for (const file of files) {
        const filePath = path.join(publicDir, file);
        expect(fs.existsSync(filePath)).toBe(true);
        const buf = fs.readFileSync(filePath);
        expect(buf[0]).toBe(0x89);
        expect(buf[1]).toBe(0x50);
        expect(buf[2]).toBe(0x4e);
        expect(buf[3]).toBe(0x47);
      }
    });

    it('verifies crisp SVG shield icons exist in frontend/public', () => {
      const svgPath = path.join(publicDir, 'shield.svg');
      expect(fs.existsSync(svgPath)).toBe(true);
      const svgContent = fs.readFileSync(svgPath, 'utf-8');
      expect(svgContent).toContain('<svg');
      expect(svgContent).toContain('shieldGrad');
    });
  });

  describe('Next.js Layout Metadata Integration', () => {
    it('verifies layout.tsx defines manifest and icon links in metadata', () => {
      expect(metadata.manifest).toBe('/manifest.json');
      expect(metadata.icons).toBeDefined();

      const iconsObj = metadata.icons as any;
      expect(iconsObj.icon).toBeDefined();
      expect(iconsObj.apple).toBeDefined();
    });

    it('verifies viewport themeColor matches TrustPay brand #09090b', () => {
      expect(viewport.themeColor).toBe('#09090b');
    });
  });
});
