'use client';

import React, { useState } from 'react';

export const REACTION_EMOJIS = ['👍', '🚀', '❤️', '👀', '🛠️'] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface MessageReactionRecord {
  emoji: ReactionEmoji;
  count: number;
  users: string[];
}

export interface MessageReactionBarProps {
  messageId: string;
  currentUserAddress: string;
  initialReactions?: MessageReactionRecord[];
  onToggleReaction?: (messageId: string, emoji: ReactionEmoji, isAdded: boolean) => void;
  className?: string;
}

export function MessageReactionBar({
  messageId,
  currentUserAddress,
  initialReactions = [],
  onToggleReaction,
  className = '',
}: MessageReactionBarProps) {
  const [reactions, setReactions] = useState<MessageReactionRecord[]>(initialReactions);
  const [showPicker, setShowPicker] = useState(false);

  const handleToggle = (emoji: ReactionEmoji) => {
    setReactions((prev) => {
      const normalizedUser = currentUserAddress.toLowerCase();
      const existing = prev.find((r) => r.emoji === emoji);

      let updated: MessageReactionRecord[];
      let isAdded = false;

      if (existing) {
        const hasReacted = existing.users.some((u) => u.toLowerCase() === normalizedUser);
        if (hasReacted) {
          // Remove reaction
          const newUsers = existing.users.filter((u) => u.toLowerCase() !== normalizedUser);
          if (newUsers.length === 0) {
            updated = prev.filter((r) => r.emoji !== emoji);
          } else {
            updated = prev.map((r) =>
              r.emoji === emoji ? { ...r, count: newUsers.length, users: newUsers } : r
            );
          }
          isAdded = false;
        } else {
          // Add user to reaction
          const newUsers = [...existing.users, currentUserAddress];
          updated = prev.map((r) =>
            r.emoji === emoji ? { ...r, count: newUsers.length, users: newUsers } : r
          );
          isAdded = true;
        }
      } else {
        // First reaction for this emoji
        updated = [...prev, { emoji, count: 1, users: [currentUserAddress] }];
        isAdded = true;
      }

      if (onToggleReaction) {
        onToggleReaction(messageId, emoji, isAdded);
      }

      return updated;
    });

    setShowPicker(false);
  };

  return (
    <div
      data-testid={`reaction-bar-${messageId}`}
      className={`relative inline-flex flex-col space-y-1 ${className}`}
      onMouseEnter={() => setShowPicker(true)}
      onMouseLeave={() => setShowPicker(false)}
    >
      {/* Floating Reaction Toolbar */}
      {showPicker && (
        <div
          data-testid="floating-reaction-toolbar"
          className="absolute -top-8 right-0 z-20 flex items-center space-x-1 px-2 py-1 rounded-full bg-[#18181b]/95 border border-[#333338] shadow-lg backdrop-blur-md animate-fadeIn"
        >
          {REACTION_EMOJIS.map((emoji) => {
            const hasReacted = reactions
              .find((r) => r.emoji === emoji)
              ?.users.some((u) => u.toLowerCase() === currentUserAddress.toLowerCase());

            return (
              <button
                key={emoji}
                type="button"
                data-testid={`picker-emoji-${emoji}`}
                onClick={() => handleToggle(emoji)}
                className={`w-6 h-6 flex items-center justify-center text-xs rounded-full hover:scale-125 transition-transform ${
                  hasReacted ? 'bg-indigo-600/30' : 'hover:bg-[#27272a]'
                }`}
                title={`React with ${emoji}`}
              >
                <span>{emoji}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Trigger & Active Reaction Bubbles */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {reactions.map((r) => {
          const hasReacted = r.users.some(
            (u) => u.toLowerCase() === currentUserAddress.toLowerCase()
          );

          return (
            <button
              key={r.emoji}
              type="button"
              data-testid={`reaction-badge-${r.emoji}`}
              onClick={() => handleToggle(r.emoji)}
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[11px] font-medium border transition-all hover:scale-105 active:scale-95 ${
                hasReacted
                  ? 'bg-indigo-600/20 border-indigo-500/50 text-indigo-300 shadow-sm shadow-indigo-600/10'
                  : 'bg-[#232326] border-[#333338] text-[#a1a1aa] hover:border-[#3f3f46]'
              }`}
            >
              <span>{r.emoji}</span>
              <span data-testid={`reaction-count-${r.emoji}`}>{r.count}</span>
            </button>
          );
        })}

        {/* Small Add Reaction Button if toolbar hidden */}
        <button
          type="button"
          data-testid="add-reaction-trigger"
          onClick={() => setShowPicker(!showPicker)}
          className="text-[#71717a] hover:text-[#a1a1aa] text-xs px-1.5 py-0.5 rounded-md hover:bg-[#232326] transition-colors"
          title="Add reaction"
        >
          +😊
        </button>
      </div>
    </div>
  );
}
