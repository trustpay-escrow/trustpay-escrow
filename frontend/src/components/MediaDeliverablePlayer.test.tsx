import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MediaDeliverablePlayer } from './MediaDeliverablePlayer';

const comments = [
  { id: 'c2', time: 83, text: 'Change the colour grade' },
  { id: 'c1', time: 10, text: 'Trim intro' },
];

function setup(props: Partial<React.ComponentProps<typeof MediaDeliverablePlayer>> = {}) {
  const utils = render(<MediaDeliverablePlayer src="/cut.mp4" comments={comments} {...props} />);
  const media = screen.getByTestId('media-element') as HTMLVideoElement;
  Object.defineProperty(media, 'duration', { value: 120, configurable: true });
  Object.defineProperty(media, 'paused', { value: true, configurable: true });
  media.play = vi.fn().mockResolvedValue(undefined);
  fireEvent.loadedMetadata(media);
  return { ...utils, media };
}

describe('MediaDeliverablePlayer', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
  });

  it('renders comment pins and lists them in time order', () => {
    setup();
    expect(screen.getAllByTestId('comment-pin')).toHaveLength(2);
    const jumps = screen.getAllByTestId('comment-jump').map((b) => b.textContent);
    expect(jumps).toEqual(['0:10', '1:23']);
    expect(screen.getByTestId('time-display')).toHaveTextContent('0:00 / 2:00');
  });

  it('jumps playback to a comment timestamp and plays', () => {
    const { media } = setup();
    fireEvent.click(screen.getAllByTestId('comment-jump')[1]);
    expect(media.currentTime).toBe(83);
    expect(media.play).toHaveBeenCalled();
  });

  it('seeks with the keyboard on the waveform', () => {
    const { media } = setup();
    fireEvent.keyDown(screen.getByTestId('waveform'), { key: 'ArrowRight' });
    expect(media.currentTime).toBe(5);
  });

  it('submits a comment at the current playback time', async () => {
    const onAddComment = vi.fn();
    const { media } = setup({ onAddComment });
    media.currentTime = 42;
    fireEvent.timeUpdate(media);
    expect(screen.getByTestId('comment-time')).toHaveTextContent('0:42');

    fireEvent.change(screen.getByLabelText('Revision comment'), { target: { value: 'Louder please' } });
    fireEvent.submit(screen.getByTestId('comment-form'));
    await waitFor(() => expect(onAddComment).toHaveBeenCalledWith({ time: 42, text: 'Louder please' }));
  });

  it('uses a pinned moment instead of live playback time', async () => {
    const onAddComment = vi.fn();
    const { media } = setup({ onAddComment });
    media.currentTime = 20;
    fireEvent.timeUpdate(media);
    fireEvent.click(screen.getByText('Pin this moment'));
    media.currentTime = 60;
    fireEvent.timeUpdate(media);
    expect(screen.getByTestId('comment-time')).toHaveTextContent('0:20');
    fireEvent.change(screen.getByLabelText('Revision comment'), { target: { value: 'x' } });
    fireEvent.submit(screen.getByTestId('comment-form'));
    await waitFor(() => expect(onAddComment).toHaveBeenCalledWith({ time: 20, text: 'x' }));
  });

  it('hides the comment form when read-only', () => {
    setup({ canComment: false });
    expect(screen.queryByTestId('comment-form')).not.toBeInTheDocument();
  });
});
