import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initSocketIO } from './socketHandler';

vi.mock('../lib/redis', () => ({
  getRedisClient: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
    keys: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../lib/db', () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
}));

describe('Socket.IO Handler Initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should register middleware and connection event', () => {
    const mockIo = {
      use: vi.fn(),
      on: vi.fn(),
    } as any;

    initSocketIO(mockIo);

    expect(mockIo.use).toHaveBeenCalled();
    expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });
});
