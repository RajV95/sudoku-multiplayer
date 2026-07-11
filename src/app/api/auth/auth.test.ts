import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST as registerHandler } from './register/route';
import { POST as loginHandler } from './login/route';
import { POST as logoutHandler } from './logout/route';
import User from '@/models/User';
import bcrypt from 'bcryptjs';

vi.mock('@/lib/db', () => ({
  connectToDatabase: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/models/User', () => {
  const mockUser = {
    findOne: vi.fn(),
    create: vi.fn(),
    findById: vi.fn(),
  };
  return {
    default: mockUser,
  };
});

vi.mock('bcryptjs', () => ({
  default: {
    genSalt: vi.fn().mockResolvedValue('salt'),
    hash: vi.fn().mockResolvedValue('hashed_password'),
    compare: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    set: vi.fn(),
    get: vi.fn(),
  }),
}));

describe('Auth API Handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Register Handler', () => {
    it('should return 400 if fields are missing', async () => {
      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toContain('required');
    });

    it('should return 409 if username is taken', async () => {
      vi.mocked(User.findOne).mockResolvedValue({ username: 'testuser' });

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'testuser', password: 'password123' }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(409);
      const json = await res.json();
      expect(json.error).toContain('taken');
    });

    it('should register a new user successfully', async () => {
      vi.mocked(User.findOne).mockResolvedValue(null);
      vi.mocked(User.create).mockResolvedValue({ _id: 'mock_id', username: 'newuser' } as any);

      const req = new Request('http://localhost/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username: 'newuser', password: 'password123' }),
      });

      const res = await registerHandler(req);
      expect(res.status).toBe(201);
      const json = await res.json();
      expect(json.message).toContain('successfully');
    });
  });

  describe('Login Handler', () => {
    it('should login user and issue cookie if credentials match', async () => {
      vi.mocked(User.findOne).mockResolvedValue({
        _id: 'user_id',
        username: 'loginuser',
        passwordHash: 'hashed_password',
        stats: {},
      } as any);
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      const req = new Request('http://localhost/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'loginuser', password: 'password123' }),
      });

      const res = await loginHandler(req);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toContain('Logged in');
    });
  });

  describe('Logout Handler', () => {
    it('should log out user by expiring token cookie', async () => {
      const res = await logoutHandler();
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.message).toContain('Logged out');
    });
  });
});
