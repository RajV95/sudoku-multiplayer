import { describe, it, expect, vi } from 'vitest';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
  }),
}));

vi.mock('@/lib/socket', () => ({
  getSocket: () => ({
    connect: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn(),
  }),
}));

describe('Frontend Pages Loading', () => {
  it('should import register page correctly', async () => {
    const Register = (await import('./register/page')).default;
    expect(Register).toBeTypeOf('function');
  });

  it('should import login page correctly', async () => {
    const Login = (await import('./page')).default;
    expect(Login).toBeTypeOf('function');
  });

  it('should import lobby page correctly', async () => {
    const Lobby = (await import('./lobby/page')).default;
    expect(Lobby).toBeTypeOf('function');
  });
});
