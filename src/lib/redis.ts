import { createClient, RedisClientType } from 'redis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

interface GlobalRedis {
  client: RedisClientType | null;
  promise: Promise<RedisClientType> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var redisGlobal: GlobalRedis | undefined;
}

let cached = global.redisGlobal;

if (!cached) {
  cached = global.redisGlobal = { client: null, promise: null };
}

export async function getRedisClient(): Promise<RedisClientType> {
  if (cached.client) {
    return cached.client;
  }

  if (!cached.promise) {
    const client = createClient({
      url: REDIS_URL,
    }) as RedisClientType;

    client.on('error', (err) => {
      console.error('Redis client error:', err);
    });

    cached.promise = client.connect().then(() => {
      return client;
    });
  }

  try {
    cached.client = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.client;
}
