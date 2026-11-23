'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clampTime,
  decodeWaveform,
  fallbackPeaks,
  formatTimestamp,
  pinPositionPercent,
  sortComments,
  timeFromPointer,
  type TimestampComment,
} from '@/lib/media-annotations';

const WAVEFORM_BARS = 120;
const SEEK_STEP = 5;
const MAX_COMMENT_LENGTH = 500;

export interface MediaDeliverablePlayerProps {
  src: string;
  kind?: 'audio' | 'video';
  title?: string;
  poster?: string;
  comments?: TimestampComment[];
  /** When false the player is read-only (e.g. the freelancer reviewing feedback). */
  canComment?: boolean;
  onAddComment?: (comment: { time: number; text: string }) => void | Promise<void>;
  onResolveComment?: (id: string) => void;
  className?: string;
}

export function MediaDeliverablePlayer({
  src,
  kind = 'video',
  title = 'Milestone deliverable',
  poster,
  comments = [],
  canComment = true,
  onAddComment,
  onResolveComment,
  className = '',
}: MediaDeliverablePlayerProps) {
  const mediaRef = useRef<HTMLVideoElement & HTMLAudioElement>(null);
  const waveformRef = useRef<HTMLDivElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [decoded, setDecoded] = useState<{ src: string; peaks: number[] } | null>(null);
  const [draft, setDraft] = useState('');
  const [pinnedTime, setPinnedTime] = useState<number | null>(null);
  const [activePin, setActivePin] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Show a deterministic placeholder until (or unless) the real waveform decodes for this src.
  const peaks = useMemo(
    () => (decoded?.src === src ? decoded.peaks : fallbackPeaks(src, WAVEFORM_BARS)),
    [decoded, src]
  );
  const sorted = useMemo(() => sortComments(comments), [comments]);

  useEffect(() => {
    const controller = new AbortController();
    void decodeWaveform(src, WAVEFORM_BARS, controller.signal).then((next) => {
      if (!controller.signal.aborted) setDecoded({ src, peaks: next });
    });
    return () => controller.abort();
  }, [src]);

  const seek = useCallback(
    (time: number, autoplay = false) => {
      const media = mediaRef.current;
      if (!media) return;
      const target = clampTime(time, media.duration || duration);
      media.currentTime = target;
      setCurrentTime(target);
      if (autoplay) void media.play?.();
    },
    [duration]
  );

  const togglePlay = () => {
    const media = mediaRef.current;
    if (!media) return;
    if (media.paused) void media.play?.();
    else media.pause?.();
  };

  const handleWaveformPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const rect = waveformRef.current?.getBoundingClientRect();
    if (!rect) return;
    seek(timeFromPointer(e.clientX, rect.left, rect.width, duration));
  };

  const handleWaveformKey = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      seek(currentTime + SEEK_STEP);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      seek(currentTime - SEEK_STEP);
    } else if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      togglePlay();
    }
  };

  const commentTime = pinnedTime ?? currentTime;

  const submitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = draft.trim();
    if (!text || !onAddComment) return;
    setSubmitting(true);
    try {
      await onAddComment({ time: Math.floor(commentTime), text });
      setDraft('');
      setPinnedTime(null);
    } finally {
      setSubmitting(false);
    }
  };

  const progress = pinPositionPercent(currentTime, duration);

  return (
    <section
      className={`rounded-2xl border border-[#27272a] bg-[#09090b] p-4 text-white ${className}`}
      aria-label={`${title} player`}
      data-testid="media-deliverable-player"
    >
      <h3 className="mb-3 text-sm font-bold">{title}</h3>

      {kind === 'video' ? (
        <video
          ref={mediaRef}
          src={src}
          poster={poster}
          preload="metadata"
          className="w-full rounded-xl bg-black"
          onClick={togglePlay}
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          data-testid="media-element"
        />
      ) : (
        <audio
          ref={mediaRef}
          src={src}
          preload="metadata"
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration || 0)}
          onDurationChange={(e) => setDuration(e.currentTarget.duration || 0)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          data-testid="media-element"
        />
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={togglePlay}
          aria-label={playing ? 'Pause' : 'Play'}
          className="h-9 w-9 shrink-0 rounded-full bg-blue-600 text-sm font-bold hover:bg-blue-500"
        >
          {playing ? '❚❚' : '▶'}
        </button>
        <span className="w-24 shrink-0 text-xs tabular-nums text-[#a1a1aa]" data-testid="time-display">
          {formatTimestamp(currentTime)} / {formatTimestamp(duration)}
        </span>

        <div className="relative h-14 flex-1">
          <div
            ref={waveformRef}
            role="slider"
            tabIndex={0}
            aria-label="Seek"
            aria-valuemin={0}
            aria-valuemax={Math.floor(duration)}
            aria-valuenow={Math.floor(currentTime)}
            aria-valuetext={`${formatTimestamp(currentTime)} of ${formatTimestamp(duration)}`}
            onPointerDown={handleWaveformPointer}
            onKeyDown={handleWaveformKey}
            className="relative flex h-full cursor-pointer items-center gap-px rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            data-testid="waveform"
          >
            {peaks.map((peak, i) => {
              const played = (i / peaks.length) * 100 < progress;
              return (
                <span
                  key={i}
                  className={`flex-1 rounded-full ${played ? 'bg-blue-500' : 'bg-[#3f3f46]'}`}
                  style={{ height: `${Math.round(peak * 100)}%` }}
                />
              );
            })}
            {pinnedTime !== null && (
              <span
                className="pointer-events-none absolute inset-y-0 w-0.5 bg-amber-400"
                style={{ left: `${pinPositionPercent(pinnedTime, duration)}%` }}
                data-testid="pending-pin"
              />
            )}
          </div>

          {sorted.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setActivePin(c.id);
                seek(c.time, true);
              }}
              aria-label={`Jump to ${formatTimestamp(c.time)}: ${c.text}`}
              title={`${formatTimestamp(c.time)} — ${c.text}`}
              data-testid="comment-pin"
              className={`absolute -top-2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-[#09090b] ${
                c.resolved ? 'bg-emerald-500' : activePin === c.id ? 'bg-amber-300' : 'bg-amber-500'
              }`}
              style={{ left: `${pinPositionPercent(c.time, duration)}%` }}
            />
          ))}
        </div>
      </div>

      {canComment && (
        <form onSubmit={submitComment} className="mt-4 space-y-2" data-testid="comment-form">
          <div className="flex items-center justify-between text-xs text-[#a1a1aa]">
            <span>
              Comment at{' '}
              <strong className="text-white" data-testid="comment-time">
                {formatTimestamp(commentTime)}
              </strong>
            </span>
            {pinnedTime === null ? (
              <button
                type="button"
                onClick={() => setPinnedTime(Math.floor(currentTime))}
                className="font-semibold text-blue-400 hover:text-blue-300"
              >
                Pin this moment
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPinnedTime(null)}
                className="font-semibold text-blue-400 hover:text-blue-300"
              >
                Follow playback
              </button>
            )}
          </div>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
            placeholder="What should change at this moment?"
            rows={2}
            aria-label="Revision comment"
            className="w-full rounded-lg border border-[#27272a] bg-[#18181b] p-2 text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim() || submitting}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold disabled:opacity-40"
          >
            {submitting ? 'Adding…' : 'Add comment'}
          </button>
        </form>
      )}

      <ul className="mt-4 space-y-2" aria-label="Revision comments" data-testid="comment-list">
        {sorted.length === 0 && <li className="text-xs text-[#71717a]">No timestamped comments yet.</li>}
        {sorted.map((c) => (
          <li
            key={c.id}
            className={`flex items-start gap-2 rounded-lg border p-2 text-sm ${
              activePin === c.id ? 'border-amber-500/60' : 'border-[#27272a]'
            } ${c.resolved ? 'opacity-60' : ''}`}
          >
            <button
              type="button"
              onClick={() => {
                setActivePin(c.id);
                seek(c.time, true);
              }}
              className="shrink-0 rounded bg-[#27272a] px-2 py-0.5 text-xs font-mono text-amber-400 hover:bg-[#3f3f46]"
              data-testid="comment-jump"
            >
              {formatTimestamp(c.time)}
            </button>
            <p className="flex-1 break-words">{c.text}</p>
            {onResolveComment && !c.resolved && (
              <button
                type="button"
                onClick={() => onResolveComment(c.id)}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Resolve
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default MediaDeliverablePlayer;
