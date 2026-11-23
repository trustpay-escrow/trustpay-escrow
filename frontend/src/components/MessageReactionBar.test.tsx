import { describe, it, expect, vi } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MessageReactionBar, REACTION_EMOJIS } from './MessageReactionBar';

describe('MessageReactionBar Component (#261)', () => {
  const mockUser = 'GDJ8ABC...USER';

  it('renders with initial reaction badges and add button', () => {
    render(
      <MessageReactionBar
        messageId="msg-101"
        currentUserAddress={mockUser}
        initialReactions={[
          { emoji: '👍', count: 2, users: ['OTHER_1', 'OTHER_2'] },
        ]}
      />
    );

    expect(screen.getByTestId('reaction-bar-msg-101')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-badge-👍')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-count-👍')).toHaveTextContent('2');
    expect(screen.getByTestId('add-reaction-trigger')).toBeInTheDocument();
  });

  it('displays floating emoji picker when clicking add reaction trigger', () => {
    render(
      <MessageReactionBar
        messageId="msg-102"
        currentUserAddress={mockUser}
      />
    );

    const trigger = screen.getByTestId('add-reaction-trigger');
    fireEvent.click(trigger);

    expect(screen.getByTestId('floating-reaction-toolbar')).toBeInTheDocument();
    REACTION_EMOJIS.forEach((emoji) => {
      expect(screen.getByTestId(`picker-emoji-${emoji}`)).toBeInTheDocument();
    });
  });

  it('increments count when user selects an emoji', () => {
    const handleToggle = vi.fn();
    render(
      <MessageReactionBar
        messageId="msg-103"
        currentUserAddress={mockUser}
        onToggleReaction={handleToggle}
      />
    );

    // Open toolbar
    fireEvent.click(screen.getByTestId('add-reaction-trigger'));
    // Select rocket 🚀
    fireEvent.click(screen.getByTestId('picker-emoji-🚀'));

    expect(screen.getByTestId('reaction-badge-🚀')).toBeInTheDocument();
    expect(screen.getByTestId('reaction-count-🚀')).toHaveTextContent('1');
    expect(handleToggle).toHaveBeenCalledWith('msg-103', '🚀', true);
  });

  it('toggles off reaction when clicking existing active reaction badge', () => {
    const handleToggle = vi.fn();
    render(
      <MessageReactionBar
        messageId="msg-104"
        currentUserAddress={mockUser}
        initialReactions={[
          { emoji: '❤️', count: 1, users: [mockUser] },
        ]}
        onToggleReaction={handleToggle}
      />
    );

    const heartBadge = screen.getByTestId('reaction-badge-❤️');
    expect(heartBadge).toBeInTheDocument();

    // Click again to toggle off
    fireEvent.click(heartBadge);

    expect(screen.queryByTestId('reaction-badge-❤️')).not.toBeInTheDocument();
    expect(handleToggle).toHaveBeenCalledWith('msg-104', '❤️', false);
  });
});
