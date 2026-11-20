'use client';

import React, { useRef, useState } from 'react';
import { toast } from 'sonner';

export interface FileUploadDragDropProps {
  onFilesSelected: (files: File[]) => void;
  maxFileSize?: number; // in bytes
  maxFiles?: number;
  acceptedFileTypes?: string[]; // e.g., ['.pdf', '.zip', '.docx', '.jpg', '.png']
  disabled?: boolean;
  className?: string;
}

export interface FileWarning {
  fileName: string;
  reason: 'size' | 'type' | 'count';
  details: string;
}

const DEFAULT_MAX_SIZE = 25 * 1024 * 1024; // 25 MB
const DEFAULT_MAX_FILES = 20;
const DEFAULT_ACCEPTED_TYPES = ['.pdf', '.zip', '.docx', '.xlsx', '.pptx', '.jpg', '.jpeg', '.png', '.gif', '.svg', '.md', '.txt'];

export function FileUploadDragDrop({
  onFilesSelected,
  maxFileSize = DEFAULT_MAX_SIZE,
  maxFiles = DEFAULT_MAX_FILES,
  acceptedFileTypes = DEFAULT_ACCEPTED_TYPES,
  disabled = false,
  className = '',
}: FileUploadDragDropProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [warnings, setWarnings] = useState<FileWarning[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getFileExtension = (fileName: string): string => {
    const lastDot = fileName.lastIndexOf('.');
    return lastDot === -1 ? '' : fileName.substring(lastDot).toLowerCase();
  };

  const formatBytes = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const validateFiles = (filesToValidate: File[]): { valid: File[]; warnings: FileWarning[] } => {
    const validFiles: File[] = [];
    const newWarnings: FileWarning[] = [];

    filesToValidate.forEach((file) => {
      const ext = getFileExtension(file.name);

      // Check file type
      if (!acceptedFileTypes.includes(ext)) {
        newWarnings.push({
          fileName: file.name,
          reason: 'type',
          details: `File type ${ext || 'unknown'} not allowed. Accepted: ${acceptedFileTypes.join(', ')}`,
        });
        return;
      }

      // Check file size
      if (file.size > maxFileSize) {
        newWarnings.push({
          fileName: file.name,
          reason: 'size',
          details: `File size ${formatBytes(file.size)} exceeds limit of ${formatBytes(maxFileSize)}`,
        });
        return;
      }

      validFiles.push(file);
    });

    // Check total file count
    if (validFiles.length > maxFiles) {
      const excess = validFiles.length - maxFiles;
      newWarnings.push({
        fileName: `${excess} file(s)`,
        reason: 'count',
        details: `Maximum ${maxFiles} files allowed. ${excess} file(s) will be discarded.`,
      });
    }

    return {
      valid: validFiles.slice(0, maxFiles),
      warnings: newWarnings,
    };
  };

  const handleFiles = (filesToProcess: File[]) => {
    const { valid, warnings: newWarnings } = validateFiles(filesToProcess);

    if (newWarnings.length > 0) {
      setWarnings(newWarnings);
      newWarnings.forEach((warning) => {
        if (warning.reason === 'size') {
          toast.error(`File size warning: ${warning.fileName}`);
        } else if (warning.reason === 'type') {
          toast.error(`File type not supported: ${warning.fileName}`);
        } else if (warning.reason === 'count') {
          toast.warning(`Maximum files exceeded: ${warning.details}`);
        }
      });
    } else {
      setWarnings([]);
    }

    if (valid.length > 0) {
      onFilesSelected(valid);
      toast.success(`${valid.length} file(s) selected successfully`);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const droppedFiles = Array.from(e.dataTransfer.files);
    handleFiles(droppedFiles);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    handleFiles(selectedFiles);
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleClick = () => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`w-full space-y-4 ${className}`}>
      {/* Drag and Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={`relative flex flex-col items-center justify-center p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all duration-200 cursor-pointer ${
          disabled
            ? 'bg-gray-900/30 border-gray-700/30 opacity-50 cursor-not-allowed'
            : isDragOver
              ? 'bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/10'
              : 'bg-gray-900/20 border-gray-700/50 hover:border-blue-500/50 hover:bg-blue-500/5'
        }`}
      >
        {/* Upload Icon */}
        <div className={`mb-4 p-3 rounded-full ${isDragOver ? 'bg-blue-500/20' : 'bg-gray-800/50'}`}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className={`w-8 h-8 transition-all ${isDragOver ? 'text-blue-400 scale-110' : 'text-gray-400'}`}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9 16.17L4.83 12m0 0l-1.41 1.41L9 19l12-12-1.41-1.41L9 16.17z"
            />
          </svg>
        </div>

        {/* Title and Description */}
        <h3 className="text-lg font-bold text-white mb-2 text-center">
          {isDragOver ? 'Drop files here' : 'Drag and drop files here'}
        </h3>
        <p className="text-sm text-gray-400 text-center mb-4">
          or{' '}
          <span className="text-blue-400 font-semibold hover:text-blue-300">click to browse</span>
        </p>

        {/* File Type and Size Info */}
        <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
          <div className="p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <p className="text-xs text-gray-500 font-medium mb-1">Accepted Types</p>
            <p className="text-xs text-gray-300 font-mono overflow-x-auto">
              {acceptedFileTypes.slice(0, 4).join(', ')}
              {acceptedFileTypes.length > 4 && `+${acceptedFileTypes.length - 4}`}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-gray-800/50 border border-gray-700/50">
            <p className="text-xs text-gray-500 font-medium mb-1">Max Size</p>
            <p className="text-xs text-gray-300 font-mono">{formatBytes(maxFileSize)}</p>
          </div>
        </div>

        {/* Limit Info */}
        <p className="text-xs text-gray-500 mt-4 text-center">
          Maximum {maxFiles} files, each up to {formatBytes(maxFileSize)}
        </p>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileInputChange}
          disabled={disabled}
          className="hidden"
          accept={acceptedFileTypes.join(',')}
        />
      </div>

      {/* Warning Badges Section */}
      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-wider">
            ⚠️ File Issues Detected
          </p>
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-3 rounded-lg border ${
                  warning.reason === 'size'
                    ? 'bg-red-500/10 border-red-500/20'
                    : warning.reason === 'type'
                      ? 'bg-orange-500/10 border-orange-500/20'
                      : 'bg-yellow-500/10 border-yellow-500/20'
                }`}
              >
                <div className="flex-shrink-0 mt-0.5">
                  {warning.reason === 'size' ? (
                    <svg
                      className="w-4 h-4 text-red-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4v2m0 4v2"
                      />
                    </svg>
                  ) : warning.reason === 'type' ? (
                    <svg
                      className="w-4 h-4 text-orange-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4v2"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-4 h-4 text-yellow-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p
                    className={`text-xs font-semibold ${
                      warning.reason === 'size'
                        ? 'text-red-400'
                        : warning.reason === 'type'
                          ? 'text-orange-400'
                          : 'text-yellow-400'
                    }`}
                  >
                    {warning.fileName}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">{warning.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUploadDragDrop;
