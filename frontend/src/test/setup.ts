import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: vi.fn().mockImplementation(() => Promise.resolve()),
  },
});
