import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  DeliverableFolderTree,
  parsePathsToTree,
  getFileCategory,
  formatFileSize,
  FileItem,
} from './DeliverableFolderTree';

describe('DeliverableFolderTree Component & Helpers', () => {
  describe('Helper Functions', () => {
    it('categorizes file types correctly based on extension', () => {
      expect(getFileCategory('app.tsx')).toBe('code');
      expect(getFileCategory('contract.sol')).toBe('code');
      expect(getFileCategory('logo.png')).toBe('image');
      expect(getFileCategory('receipt.pdf')).toBe('pdf');
      expect(getFileCategory('source.zip')).toBe('archive');
      expect(getFileCategory('notes.txt')).toBe('document');
      expect(getFileCategory('noextension')).toBe('document');
    });

    it('formats file sizes into human-readable strings', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(2048)).toBe('2.0 KB');
      expect(formatFileSize(5 * 1024 * 1024)).toBe('5.0 MB');
      expect(formatFileSize(undefined)).toBe('');
    });

    it('parses slash-delimited file paths into nested hierarchy', () => {
      const files: FileItem[] = [
        { path: 'src/components/Button.tsx', size: 1024 },
        { path: 'src/utils/math.ts', size: 512 },
        { path: 'README.md', size: 256 },
        { path: 'assets/logo.png', size: 2048 },
      ];

      const tree = parsePathsToTree(files);

      // Folders should sort before files
      expect(tree.length).toBe(3); // assets, src, README.md
      expect(tree[0].name).toBe('assets');
      expect(tree[0].isFolder).toBe(true);
      expect(tree[0].children?.length).toBe(1);
      expect(tree[0].children?.[0].name).toBe('logo.png');

      expect(tree[1].name).toBe('src');
      expect(tree[1].isFolder).toBe(true);
      expect(tree[1].children?.length).toBe(2); // components, utils

      expect(tree[2].name).toBe('README.md');
      expect(tree[2].isFolder).toBe(false);
    });
  });

  describe('DeliverableFolderTree Component', () => {
    const mockFiles: FileItem[] = [
      { path: 'contracts/Escrow.sol', size: 4096, url: 'https://example.com/Escrow.sol' },
      { path: 'contracts/interfaces/IEscrow.sol', size: 1024 },
      { path: 'docs/architecture.pdf', size: 1024 * 1024 * 2 },
      { path: 'package.json', size: 512 },
    ];

    it('renders empty message when files list is empty', () => {
      render(<DeliverableFolderTree files={[]} />);
      expect(screen.getByText('No deliverable files attached.')).toBeInTheDocument();
    });

    it('renders folder hierarchy with file counts and badges', () => {
      render(<DeliverableFolderTree files={mockFiles} />);

      expect(screen.getByText('Deliverable Files Hierarchy')).toBeInTheDocument();
      expect(screen.getByText('4 files')).toBeInTheDocument();

      // Folder names visible
      expect(screen.getByText('contracts')).toBeInTheDocument();
      expect(screen.getByText('docs')).toBeInTheDocument();
      expect(screen.getByText('package.json')).toBeInTheDocument();
    });

    it('toggles folder expand and collapse when folder row is clicked', () => {
      render(<DeliverableFolderTree files={mockFiles} />);

      const contractsToggle = screen.getByTestId('folder-toggle-contracts');
      const chevron = screen.getByTestId('chevron-contracts');

      // Initially expanded
      expect(chevron.className).toContain('rotate-90');
      expect(screen.getByText('Escrow.sol')).toBeInTheDocument();

      // Click to collapse
      fireEvent.click(contractsToggle);
      expect(chevron.className).toContain('rotate-0');
      expect(screen.queryByText('Escrow.sol')).not.toBeInTheDocument();

      // Click to expand again
      fireEvent.click(contractsToggle);
      expect(chevron.className).toContain('rotate-90');
      expect(screen.getByText('Escrow.sol')).toBeInTheDocument();
    });

    it('expands and collapses all folders when header action buttons are clicked', () => {
      render(<DeliverableFolderTree files={mockFiles} />);

      const collapseAllBtn = screen.getByTestId('collapse-all-btn');
      const expandAllBtn = screen.getByTestId('expand-all-btn');

      // Collapse all
      fireEvent.click(collapseAllBtn);
      expect(screen.queryByText('Escrow.sol')).not.toBeInTheDocument();
      expect(screen.queryByText('architecture.pdf')).not.toBeInTheDocument();

      // Expand all
      fireEvent.click(expandAllBtn);
      expect(screen.getByText('Escrow.sol')).toBeInTheDocument();
      expect(screen.getByText('architecture.pdf')).toBeInTheDocument();
    });

    it('invokes onDownloadFile when download button is clicked', () => {
      const handleDownload = vi.fn();
      render(<DeliverableFolderTree files={mockFiles} onDownloadFile={handleDownload} />);

      const downloadBtn = screen.getByTestId('download-button-package.json');
      fireEvent.click(downloadBtn);

      expect(handleDownload).toHaveBeenCalledTimes(1);
      expect(handleDownload).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'package.json',
          path: 'package.json',
          category: 'code',
        })
      );
    });
  });
});
