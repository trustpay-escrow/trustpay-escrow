import React from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { DeliverableChecksums, FileChecksumBadge } from './FileChecksumBadge';
import { formatAttachmentLine } from '@/lib/checksum';

// SHA-256("abc")
const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';

function upload(contents: string) {
  const input = screen.getByTestId('checksum-file-input') as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File([contents], 'deliverable.txt')] } });
}

describe('FileChecksumBadge (#254)', () => {
  it('shows the truncated hash next to the verify action', () => {
    render(<FileChecksumBadge hash={ABC} />);
    expect(screen.getByTestId('checksum-hash')).toHaveTextContent('sha256: ba78...15ad');
    expect(screen.getByTestId('checksum-verify-button')).toHaveTextContent('Verify File Integrity');
  });

  it('shows a green check when the downloaded file matches', async () => {
    render(<FileChecksumBadge hash={ABC} />);
    upload('abc');
    expect(await screen.findByTestId('checksum-verified')).toBeInTheDocument();
    expect(screen.queryByTestId('checksum-tampered')).not.toBeInTheDocument();
  });

  it('shows a red warning when the file was tampered with', async () => {
    render(<FileChecksumBadge hash={ABC} />);
    upload('abc but modified');
    const warning = await screen.findByTestId('checksum-tampered');
    expect(warning).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('checksum-verified')).not.toBeInTheDocument();
  });

  it('renders the verified and tampered states from a controlled status', () => {
    const { rerender } = render(<FileChecksumBadge hash={ABC} status="verified" />);
    expect(screen.getByTestId('checksum-verified')).toBeInTheDocument();
    rerender(<FileChecksumBadge hash={ABC} status="tampered" />);
    expect(screen.getByTestId('checksum-tampered')).toBeInTheDocument();
  });

  it('opens the file picker from the verify button', async () => {
    render(<FileChecksumBadge hash={ABC} />);
    const input = screen.getByTestId('checksum-file-input') as HTMLInputElement;
    let clicked = false;
    input.addEventListener('click', () => {
      clicked = true;
    });
    fireEvent.click(screen.getByTestId('checksum-verify-button'));
    await waitFor(() => expect(clicked).toBe(true));
  });
});

describe('DeliverableChecksums', () => {
  it('renders a badge per hashed attachment and nothing when there are none', () => {
    const notes = `### Links & Attachments\n${formatAttachmentLine('a.pdf', '1 KB', ABC)}\n- Attachment: b.zip (2 KB)`;
    const { container, rerender } = render(<DeliverableChecksums notes={notes} />);
    expect(screen.getAllByTestId('file-checksum-badge')).toHaveLength(1);
    rerender(<DeliverableChecksums notes="no attachments" />);
    expect(container).toBeEmptyDOMElement();
  });
});
