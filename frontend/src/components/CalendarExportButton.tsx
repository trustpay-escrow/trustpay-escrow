'use client';

import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Milestone, Project } from '@/types';
import { useEscapeKey } from '@/hooks/useEscapeKey';
import {
  buildGoogleCalendarUrl,
  buildMilestoneCalendarEvents,
  buildOutlookCalendarUrl,
  downloadIcsFile,
} from '@/lib/calendar-utils';

export interface CalendarExportButtonProps {
  project: Project;
  milestones?: Milestone[];
  label?: string;
  className?: string;
  compact?: boolean;
}

export function CalendarExportButton({
  project,
  milestones,
  label = 'Add to Calendar',
  className = '',
  compact = false,
}: CalendarExportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const nextHeadingId = useId();
  const allHeadingId = useId();

  const events = useMemo(
    () => buildMilestoneCalendarEvents(project, milestones || project.milestones || []),
    [project, milestones]
  );

  const menuOpen = isOpen && events.length > 0;

  useEscapeKey(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, menuOpen);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const nextEvent = events[0];

  const filename = `${project.title || 'project'}-milestones`.replace(/[^a-z0-9-_]+/gi, '-');

  return (
    <div className={`relative ${className}`} ref={containerRef} onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        data-testid="calendar-export-button"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-controls={menuOpen ? menuId : undefined}
        onClick={() => setIsOpen((value) => !value)}
        disabled={events.length === 0}
        className={`inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/70 font-semibold text-slate-200 transition-colors hover:border-indigo-500/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 ${
          compact ? 'px-2.5 py-1 text-[11px]' : 'px-3.5 py-1.5 text-xs'
        }`}
      >
        <span aria-hidden="true">📅</span>
        {label}
        <span aria-hidden="true">▾</span>
      </button>

      {menuOpen && (
        <div
          id={menuId}
          role="menu"
          aria-label="Calendar export options"
          data-testid="calendar-export-menu"
          className="absolute right-0 z-40 mt-2 w-72 rounded-2xl border border-slate-700 bg-slate-900 p-2 shadow-2xl"
        >
          {nextEvent && (
            <div role="group" aria-labelledby={nextHeadingId} className="space-y-1 border-b border-slate-800 pb-2">
              <p id={nextHeadingId} role="presentation" className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Next deadline
              </p>
              <a
                role="menuitem"
                data-testid="google-calendar-link"
                href={buildGoogleCalendarUrl(nextEvent)}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Add to Google Calendar
              </a>
              <a
                role="menuitem"
                data-testid="outlook-calendar-link"
                href={buildOutlookCalendarUrl(nextEvent)}
                target="_blank"
                rel="noopener noreferrer"
                className="block rounded-lg px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
              >
                Add to Outlook
              </a>
              <button
                type="button"
                role="menuitem"
                data-testid="download-ics-button"
                onClick={() => {
                  downloadIcsFile(events, filename);
                  setIsOpen(false);
                }}
                className="block w-full rounded-lg px-3 py-2 text-left text-xs font-semibold text-indigo-300 hover:bg-indigo-500/15"
              >
                Download .ics File
              </button>
            </div>
          )}

          <div role="group" aria-labelledby={allHeadingId} className="pt-2">
            <p id={allHeadingId} role="presentation" className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              All milestones ({events.length})
            </p>
            <div role="none" className="max-h-56 space-y-0.5 overflow-y-auto">
              {events.map((event) => (
                <div key={event.id} role="none" className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-800">
                  <span role="presentation" className="min-w-0 flex-1 truncate text-[11px] text-slate-300" title={event.title}>
                    {event.title}
                  </span>
                  <a
                    role="menuitem"
                    href={buildGoogleCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Add ${event.title} to Google Calendar`}
                    className="text-[10px] font-bold text-indigo-400 hover:underline"
                  >
                    Google
                  </a>
                  <a
                    role="menuitem"
                    href={buildOutlookCalendarUrl(event)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Add ${event.title} to Outlook`}
                    className="text-[10px] font-bold text-sky-400 hover:underline"
                  >
                    Outlook
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CalendarExportButton;
