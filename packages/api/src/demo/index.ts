// Demo mode: a contract-shaped, in-memory API for the console, with per-visitor state.
export { DemoApi, DemoLimit, DEMO_TOKEN } from './backend.ts';
export type { DemoListing, DemoOptions, DemoRefusal } from './backend.ts';
export { decodeState, emptyState, encodeState, fits, MAX_STATE_BYTES } from './state.ts';
export type { DemoState } from './state.ts';
