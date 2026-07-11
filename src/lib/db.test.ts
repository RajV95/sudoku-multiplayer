import { describe, it, expect, vi } from 'vitest';
import { connectToDatabase } from './db';
import mongoose from 'mongoose';

vi.mock('mongoose', () => {
  const mockMongoose = {
    connect: vi.fn().mockResolvedValue({}),
    models: {},
    model: vi.fn(),
  };
  return {
    default: mockMongoose,
  };
});

describe('Database connection helper', () => {
  it('should export connectToDatabase function', () => {
    expect(connectToDatabase).toBeTypeOf('function');
  });

  it('should call mongoose.connect', async () => {
    await connectToDatabase();
    expect(mongoose.connect).toHaveBeenCalled();
  });
});
