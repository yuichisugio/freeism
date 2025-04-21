// lib/redis.ts
import { Redis } from "@upstash/redis";

console.log("src/lib/redis.ts_redisクライアント初期化_start");

const globalForRedis = globalThis as unknown as { redis: Redis };

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl) {
  console.error("src/lib/redis.ts_redisクライアント初期化_redisUrlが設定されていません");
}

if (!redisToken) {
  console.error("src/lib/redis.ts_redisクライアント初期化_redisTokenが設定されていません");
}

const redis = globalForRedis.redis ?? Redis.fromEnv();

if (process.env.NODE_ENV !== "production") globalForRedis.redis = redis;

console.log("src/lib/redis.ts_redisクライアント初期化_end");

export { redis };
