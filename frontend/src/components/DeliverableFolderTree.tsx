'use client';

import React, { useState, useMemo, type ReactNode } from 'react';

export type FileCategory = 'code' | 'image' | 'pdf' | 'archive' | 'document';

export interface FileItem {
  id?: string;
  path: string;
  size?: number;
  url?: string;
}

export interface FileNode {
  id: string;
  name: string;
  path: string;
  size?: number;
  url?: string;
  isFolder: boolean;
  category: FileCategory;
  extension: string;
  children?: FileNode[];
}

export function getFileCategory(filename: string): FileCategory {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (['ts', 'tsx', 'js', 'jsx', 'json', 'sol', 'rs', 'py', 'go', 'html', 'css', 'yaml', 'yml'].includes(ext)) {
    return 'code';
  }
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp'].includes(ext)) {
    return 'image';
  }
  if (ext === 'pdf') {
    return 'pdf';
  }
  if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
    return 'archive';
  }
  return 'document';
}

export function formatFileSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getCategoryBadge(category: FileCategory): { icon: string; colorClass: string } {
  switch (category) {
    case 'code':
      return { icon: '</>', colorClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
    case 'image':
      return { icon: 'IMG', colorClass: 'bg-purple-500/10 text-purple-400 border-purple-500/20' };
    case 'pdf':
      return { icon: 'PDF', colorClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    case 'archive':
      return { icon: 'ZIP', colorClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
    case 'document':
    default:
      return { icon: 'DOC', colorClass: 'bg-blue-500/10 text-blue-400 border-blue-500/20' };
  }
}

/**
 * Parses flat file paths (e.g., "src/components/Button.tsx") into a nested tree.
 */
export function parsePathsToTree(files: FileItem[]): FileNode[] {
  const rootNodes: FileNode[] = [];

  for (const file of files) {
    const rawPath = file.path.replace(/\\/g, '/').replace(/^\/+/, '');
    const parts = rawPath.split('/').filter(Boolean);

    if (parts.length === 0) continue;

    let currentLevel = rootNodes;
    let accumulatedPath = '';

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${part}` : part;
      const isLast = i === parts.length - 1;

      if (isLast) {
        // File node
        const category = getFileCategory(part);
        const dotIndex = part.lastIndexOf('.');
        const extension = dotIndex !== -1 ? part.slice(dotIndex + 1) : '';

        currentLevel.push({
          id: file.id ?? accumulatedPath,
          name: part,
          path: accumulatedPath,
          size: file.size,
          url: file.url,
          isFolder: false,
          category,
          extension,
        });
      } else {
        // Folder node
        let folder = currentLevel.find((node) => node.isFolder && node.name === part);
        if (!folder) {
          folder = {
            id: accumulatedPath,
            name: part,
            path: accumulatedPath,
            isFolder: true,
            category: 'document',
            extension: '',
            children: [],
          };
          currentLevel.push(folder);
        }
        currentLevel = folder.children!;
      }
    }
  }

  // Sort nodes: folders first, then alphabetical
  function sortNodes(nodes: FileNode[]) {
    nodes.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    for (const node of nodes) {
      if (node.children) {
        sortNodes(node.children);
      }
    }
  }

  sortNodes(rootNodes);
  return rootNodes;
}

export interface DeliverableFolderTreeProps {
  files: FileItem[];
  title?: string;
  onDownloadFile?: (file: FileNode) => void;
  renderFileDetails?: (file: FileNode) => ReactNode;
  className?: string;
}

export function DeliverableFolderTree({
  files,
  title = 'Deliverable Files Hierarchy',
  onDownloadFile,
  renderFileDetails,
  className = '',
}: DeliverableFolderTreeProps) {
  const tree = useMemo(() => parsePathsToTree(files), [files]);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>(() => {
    // Default: expand all folders initially
    const initial: Record<string, boolean> = {};
    function collectFolders(nodes: FileNode[]) {
      for (const node of nodes) {
        if (node.isFolder) {
          initial[node.id] = true;
          if (node.children) collectFolders(node.children);
        }
      }
    }
    collectFolders(tree);
    return initial;
  });

  const toggleFolder = (id: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const expandAll = () => {
    const updated: Record<string, boolean> = {};
    function collect(nodes: FileNode[]) {
      for (const node of nodes) {
        if (node.isFolder) {
          updated[node.id] = true;
          if (node.children) collect(node.children);
        }
      }
    }
    collect(tree);
    setExpandedFolders(updated);
  };

  const collapseAll = () => {
    setExpandedFolders({});
  };

  const handleDownload = (file: FileNode) => {
    if (onDownloadFile) {
      onDownloadFile(file);
    } else if (file.url) {
      const link = document.createElement('a');
      link.href = file.url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const renderTreeNodes = (nodes: FileNode[], depth = 0) => {
    return (
      <ul className="space-y-1">
        {nodes.map((node) => {
          if (node.isFolder) {
            const isExpanded = !!expandedFolders[node.id];
            const childCount = node.children?.length || 0;

            return (
              <li key={node.id} className="select-none">
                <button
                  type="button"
                  onClick={() => toggleFolder(node.id)}
                  aria-expanded={isExpanded}
                  data-testid={`folder-toggle-${node.id}`}
                  style={{ paddingLeft: `${depth * 16 + 8}px` }}
                  className="w-full flex items-center justify-between py-1.5 pr-2 rounded-lg text-left text-xs text-[#e4e4e7] hover:bg-[#27272a]/60 hover:text-white transition-colors group"
                >
                  <div className="flex items-center space-x-2 truncate">
                    <span
                      data-testid={`chevron-${node.id}`}
                      className={`text-[10px] text-[#71717a] transition-transform duration-200 motion-reduce:transition-none inline-block ${
                        isExpanded ? 'rotate-90' : 'rotate-0'
                      }`}
                    >
                      ▶
                    </span>
                    <span className="text-[#a1a1aa] font-semibold">📁</span>
                    <span className="font-semibold text-white tracking-wide truncate">{node.name}</span>
                  </div>
                  <span className="text-[10px] text-[#71717a] bg-[#27272a] px-1.5 py-0.5 rounded-full border border-[#3f3f46]">
                    {childCount} {childCount === 1 ? 'item' : 'items'}
                  </span>
                </button>

                {isExpanded && node.children && (
                  <div className="border-l border-[#27272a] ml-3">
                    {renderTreeNodes(node.children, depth + 1)}
                  </div>
                )}
              </li>
            );
          }

          // File item
          const badge = getCategoryBadge(node.category);

          return (
            <li
              key={node.id}
              data-testid={`file-item-${node.id}`}
              style={{ paddingLeft: `${depth * 16 + 24}px` }}
              className="py-1.5 pr-2 rounded-lg text-xs hover:bg-[#27272a]/40 transition-colors group"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center space-x-2 truncate min-w-0">
                  <span className={`text-[9px] font-mono px-1 py-0.5 rounded border uppercase shrink-0 font-bold ${badge.colorClass}`}>
                    {badge.icon}
                  </span>
                  <span className="text-[#e4e4e7] truncate group-hover:text-white font-mono text-[11px]">{node.name}</span>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {node.size !== undefined && (
                    <span className="text-[10px] text-[#71717a] font-mono">{formatFileSize(node.size)}</span>
                  )}
                  {(onDownloadFile || node.url) && (
                    <button
                      type="button"
                      onClick={() => handleDownload(node)}
                      data-testid={`download-button-${node.path}`}
                      aria-label={`Download ${node.name}`}
                      title={`Download ${node.name}`}
                      className="px-2 py-0.5 rounded bg-[#232326] hover:bg-blue-600 hover:text-white text-[#a1a1aa] text-[10px] font-semibold border border-[#333338] transition-colors"
                    >
                      Download
                    </button>
                  )}
                </div>
              </div>
              {renderFileDetails?.(node)}
            </li>
          );
        })}
      </ul>
    );
  };

  if (files.length === 0) {
    return (
      <div className={`p-4 rounded-xl bg-[#1c1c20] border border-[#27272a] text-center text-xs text-[#71717a] ${className}`}>
        No deliverable files attached.
      </div>
    );
  }

  return (
    <div className={`bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden ${className}`} data-testid="deliverable-folder-tree">
      {/* Header with Expand / Collapse controls */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-[#202024] border-b border-[#27272a]">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-bold text-white tracking-wide">{title}</span>
          <span className="text-[10px] text-[#a1a1aa] bg-[#27272a] px-2 py-0.5 rounded-full border border-[#3f3f46]">
            {files.length} {files.length === 1 ? 'file' : 'files'}
          </span>
        </div>

        <div className="flex items-center space-x-1.5 text-[11px]">
          <button
            type="button"
            onClick={expandAll}
            data-testid="expand-all-btn"
            className="px-2 py-1 rounded bg-[#27272a] hover:bg-[#333338] text-[#a1a1aa] hover:text-white transition-colors"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={collapseAll}
            data-testid="collapse-all-btn"
            className="px-2 py-1 rounded bg-[#27272a] hover:bg-[#333338] text-[#a1a1aa] hover:text-white transition-colors"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* Tree Content */}
      <div className="p-2.5 max-h-80 overflow-y-auto">
        {renderTreeNodes(tree)}
      </div>
    </div>
  );
}

export default DeliverableFolderTree;
