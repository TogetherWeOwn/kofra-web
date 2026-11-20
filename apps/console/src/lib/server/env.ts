// The Worker's variables and secrets. Imported only by server code that runs in the Workers
// runtime; everything that interprets them lives in config.ts, which tests import directly.
import { env } from 'cloudflare:workers';
import { readConfig } from './config.js';

export const config = () => readConfig(env as unknown as Record<string, unknown>);
