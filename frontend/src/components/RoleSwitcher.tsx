'use client';

import React from 'react';
import { useWalletStore, ActiveRole } from '@/store/walletStore';
import { useRovingTabIndex } from '@/hooks/useRovingTabIndex';

export interface RoleSwitcherProps {
  className?: string;
  showDescriptions?: boolean;
}

interface RoleOption {
  id: ActiveRole;
  label: string;
  icon: string;
  activeColor: string;
  hoverColor: string;
  badgeText: string;
  description: string;
}

const ROLES: RoleOption[] = [
  {
    id: 'client',
    label: 'Client',
    icon: '👤',
    activeColor: 'bg-blue-600 text-white shadow-md shadow-blue-600/30 border-blue-500',
    hoverColor: 'hover:text-blue-300 hover:bg-[#27272a]',
    badgeText: 'Escrow Creator',
    description: 'Post jobs, fund escrows, and approve milestones',
  },
  {
    id: 'freelancer',
    label: 'Freelancer',
    icon: '💼',
    activeColor: 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30 border-indigo-500',
    hoverColor: 'hover:text-indigo-300 hover:bg-[#27272a]',
    badgeText: 'Contractor',
    description: 'Browse bounties, submit milestones, and claim payouts',
  },
  {
    id: 'arbiter',
    label: 'Arbiter',
    icon: '⚖️',
    activeColor: 'bg-amber-600 text-white shadow-md shadow-amber-600/30 border-amber-500',
    hoverColor: 'hover:text-amber-300 hover:bg-[#27272a]',
    badgeText: 'Dispute Judge',
    description: 'Review dispute claims and arbitrate consensus settlements',
  },
];

export function RoleSwitcher({ className = '', showDescriptions = false }: RoleSwitcherProps) {
  const { activeRole, setActiveRole } = useWalletStore();
  const activeIndex = Math.max(
    0,
    ROLES.findIndex((r) => r.id === activeRole)
  );
  const { getItemProps } = useRovingTabIndex({
    count: ROLES.length,
    activeIndex,
    onSelect: (index) => setActiveRole(ROLES[index].id),
    orientation: 'horizontal',
  });

  return (
    <div className={`flex flex-col items-center sm:items-end gap-1.5 ${className}`}>
      <div
        role="tablist"
        aria-label="Unified Wallet Role Switcher"
        className="flex items-center space-x-1 bg-[#1e1e24] p-1 rounded-xl border border-[#33333b] shadow-inner"
      >
        {ROLES.map((role, index) => {
          const isActive = activeRole === role.id;
          const itemProps = getItemProps(index);
          return (
            <button
              key={role.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              ref={itemProps.ref}
              tabIndex={itemProps.tabIndex}
              onKeyDown={itemProps.onKeyDown}
              data-testid={`role-btn-${role.id}`}
              onClick={() => setActiveRole(role.id)}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all duration-200 flex items-center space-x-1.5 border border-transparent ${
                isActive
                  ? role.activeColor
                  : `text-[#a1a1aa] ${role.hoverColor}`
              }`}
            >
              <span aria-hidden="true">{role.icon}</span>
              <span>{role.label}</span>
              {isActive && (
                <span className="hidden lg:inline-block text-[9px] uppercase font-extrabold tracking-wider bg-black/30 px-1.5 py-0.5 rounded-md">
                  {role.badgeText}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {showDescriptions && (
        <p className="text-[11px] text-[#71717a] transition-all">
          {ROLES.find((r) => r.id === activeRole)?.description}
        </p>
      )}
    </div>
  );
}

