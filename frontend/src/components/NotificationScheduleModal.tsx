'use client';

import React, { useId, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Project } from '@/types';
import { useNotifications } from '@/hooks/useNotifications';
import { AccessibleModal } from '@/components/a11y/AccessibleModal';
import {
  NotificationChannelKey,
  NotificationIntervalKey,
  NotificationPreferences,
} from '@/types/notification';

const INTERVALS: Array<{ key: NotificationIntervalKey; label: string; ms: number }> = [
  { key: '7d', label: '7 days before', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '3d', label: '3 days before', ms: 3 * 24 * 60 * 60 * 1000 },
  { key: '24h', label: '24 hours before', ms: 24 * 60 * 60 * 1000 },
  { key: '2h', label: '2 hours before', ms: 2 * 60 * 60 * 1000 },
];

const CHANNELS: Array<{ key: NotificationChannelKey; label: string }> = [
  { key: 'in_app', label: 'In-App' },
  { key: 'browser_push', label: 'Browser Push' },
  { key: 'telegram', label: 'Telegram Bot' },
];

function formatDateTime(value: string | Date) {
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export interface NotificationScheduleModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export function NotificationScheduleModal({ project, isOpen, onClose }: NotificationScheduleModalProps) {
  const { preferences, savePreferences, preferencesLoading } = useNotifications();
  const [draft, setDraft] = useState<NotificationPreferences>(preferences);
  const [wasOpen, setWasOpen] = useState(isOpen);
  const [saving, setSaving] = useState(false);
  const titleId = useId();
  const telegramInputId = useId();

  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setDraft(preferences);
  }

  const timetable = useMemo(() => {
    const rows: Array<{
      milestoneId: string;
      milestoneTitle: string;
      dueDate: string;
      intervalLabel: string;
      remindAt: string;
      channels: string[];
    }> = [];

    (project?.milestones || []).forEach((milestone) => {
      if (!milestone.due_date) return;
      const due = new Date(milestone.due_date);
      if (Number.isNaN(due.getTime())) return;

      INTERVALS.forEach((interval) => {
        if (!draft.intervals[interval.key]) return;
        rows.push({
          milestoneId: milestone.id,
          milestoneTitle: milestone.title,
          dueDate: milestone.due_date as string,
          intervalLabel: interval.label,
          remindAt: new Date(due.getTime() - interval.ms).toISOString(),
          channels: CHANNELS.filter((channel) => draft.channels[channel.key]).map((channel) => channel.label),
        });
      });
    });

    return rows.sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());
  }, [draft, project]);

  if (!isOpen) return null;

  const toggleInterval = (key: NotificationIntervalKey) => {
    setDraft((prev) => ({
      ...prev,
      intervals: { ...prev.intervals, [key]: !prev.intervals[key] },
    }));
  };

  const toggleChannel = async (key: NotificationChannelKey) => {
    const nextValue = !draft.channels[key];
    if (key === 'browser_push' && nextValue && typeof window !== 'undefined' && 'Notification' in window) {
      try {
        await Notification.requestPermission();
      } catch {
        // Permission denial is handled by the browser; keep the preference selectable.
      }
    }
    setDraft((prev) => ({
      ...prev,
      channels: { ...prev.channels, [key]: nextValue },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const ok = await savePreferences(draft);
      if (ok) toast.success('Notification schedule saved');
    } finally {
      setSaving(false);
    }
  };

  return (
    <AccessibleModal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy={titleId}
      backdropClassName="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      dialogClassName="bg-[#18181b] border border-[#3f3f46] rounded-2xl max-w-2xl w-full p-6 sm:p-7 space-y-5 shadow-2xl max-h-[90vh] overflow-y-auto"
    >
      <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#27272a]">
        <div>
          <h3 id={titleId} className="text-lg font-bold text-white">Milestone Deadline Reminders</h3>
          <p className="text-xs text-[#a1a1aa] mt-1">
            {project ? project.title : 'Configure alert intervals and delivery channels for milestone deadlines.'}
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-[#a1a1aa] hover:text-white text-lg" aria-label="Close reminder scheduler">
          <span aria-hidden="true">✕</span>
        </button>
      </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#e4e4e7]">Reminder intervals</h4>
            {INTERVALS.map((interval) => (
              <label key={interval.key} className="flex items-center justify-between gap-3 rounded-xl border border-[#27272a] bg-[#1c1c20] px-3.5 py-2.5 cursor-pointer">
                <span className="text-sm text-[#e4e4e7] font-medium">{interval.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(draft.intervals[interval.key])}
                  onChange={() => toggleInterval(interval.key)}
                  className="w-4 h-4 accent-blue-500"
                />
              </label>
            ))}
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#e4e4e7]">Delivery channels</h4>
            {CHANNELS.map((channel) => (
              <label key={channel.key} className="flex items-center justify-between gap-3 rounded-xl border border-[#27272a] bg-[#1c1c20] px-3.5 py-2.5 cursor-pointer">
                <span className="text-sm text-[#e4e4e7] font-medium">{channel.label}</span>
                <input
                  type="checkbox"
                  checked={Boolean(draft.channels[channel.key])}
                  onChange={() => void toggleChannel(channel.key)}
                  className="w-4 h-4 accent-blue-500"
                />
              </label>
            ))}

            {draft.channels.telegram && (
              <div className="space-y-1.5 pt-1">
                <label htmlFor={telegramInputId} className="block text-xs font-semibold text-[#e4e4e7]">Telegram chat ID</label>
                <input
                  id={telegramInputId}
                  value={draft.telegramChatId || ''}
                  onChange={(event) => setDraft((prev) => ({ ...prev, telegramChatId: event.target.value }))}
                  placeholder="123456789"
                  className="w-full px-3.5 py-2.5 bg-[#232326] border border-[#333338] rounded-xl text-sm text-white placeholder-[#71717a] focus:outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#e4e4e7]">Scheduled alert timetable</h4>
          <div className="rounded-xl border border-[#27272a] bg-[#1c1c20] max-h-56 overflow-y-auto">
            {!project ? (
              <p className="p-4 text-xs text-[#a1a1aa]">Open a project&apos;s Reminders panel to preview its milestone alert timetable.</p>
            ) : timetable.length === 0 ? (
              <p className="p-4 text-xs text-[#a1a1aa]">No milestone reminders scheduled. Enable an interval and ensure milestones have due dates.</p>
            ) : (
              timetable.map((row, index) => (
                <div key={`${row.milestoneId}-${row.intervalLabel}-${index}`} className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 px-3.5 py-2.5 border-b border-[#27272a]/70 last:border-b-0">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{row.milestoneTitle}</p>
                    <p className="text-[11px] text-[#a1a1aa]">
                      Due {formatDateTime(row.dueDate)} • {row.intervalLabel}
                    </p>
                  </div>
                  <div className="text-[11px] text-blue-300 font-semibold shrink-0">
                    {formatDateTime(row.remindAt)} • {row.channels.join(', ') || 'No channels'}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-[#27272a]">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-[#27272a] hover:bg-[#3f3f46] text-[#e4e4e7] text-xs font-semibold rounded-xl"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || preferencesLoading}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold rounded-xl"
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
    </AccessibleModal>
  );
}
