import { config } from '#lib/server/env.js';
import { makeHandle } from '#lib/server/handle.js';

export const handle = makeHandle(config);
