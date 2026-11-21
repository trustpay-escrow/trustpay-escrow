'use client';

import React from 'react';
import { SearchInput } from './SearchInput';

export interface ProjectFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  categories?: string[];
  className?: string;
}

export function ProjectFilterBar({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories = ['All', 'Development', 'Design', 'Writing', 'Marketing'],
  className = '',
}: ProjectFilterBarProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <SearchInput
        placeholder="Search projects..."
        value={searchQuery}
        onChange={onSearchChange}
      />
      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="w-full sm:w-auto px-3 py-1.5 bg-[#232326] border border-[#333338] rounded-xl text-white text-xs focus:outline-none focus:border-indigo-500 cursor-pointer"
      >
        {categories.map((cat) => (
          <option key={cat} value={cat}>
            {cat === 'All' ? 'All Categories' : cat}
          </option>
        ))}
      </select>
    </div>
  );
}

export default ProjectFilterBar;
