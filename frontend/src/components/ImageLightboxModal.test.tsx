import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ImageLightboxModal } from './ImageLightboxModal';

describe('ImageLightboxModal Escape key', () => {
  it('calls onClose once when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ImageLightboxModal imageUrl="https://example.com/a.png" onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders nothing and ignores Escape without an image', () => {
    const onClose = vi.fn();
    const { container } = render(<ImageLightboxModal imageUrl={null} onClose={onClose} />);
    expect(container).toBeEmptyDOMElement();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores Escape after unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<ImageLightboxModal imageUrl="https://example.com/a.png" onClose={onClose} />);
    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
