// The changes a visitor has made to the demo workspace, kept small enough for one cookie.
// The seed (seed.ts) is fixed; this state records only what was added or removed since.

/** A grant in compact form: [bucket, 'r' | 'rw']. */
export type CompactGrant = [string, 'r' | 'rw'];

export interface DemoState {
	v: 1;
	/** Buckets created: [name, created (Unix seconds)]. */
	b: [string, number][];
	/** Seed buckets deleted. */
	xb: string[];
	/** Keys created: [id, name or null, grants, created (Unix seconds)]. */
	k: [string, string | null, CompactGrant[], number][];
	/** Seed keys revoked. */
	xk: string[];
	/** Files uploaded: [bucket, key, size, content type, created (Unix seconds)]. */
	o: [string, string, number, string, number][];
	/** Workspace deletion requested at (Unix seconds), or 0. */
	d: number;
	/** The latest creation time handed out (Unix seconds), kept after the item is removed. */
	t?: number;
}

export const emptyState = (): DemoState => ({ v: 1, b: [], xb: [], k: [], xk: [], o: [], d: 0 });

/** Largest encoded state, in bytes; a browser keeps about 4 KB per cookie, name included. */
export const MAX_STATE_BYTES = 3600;

const isStr = (x: unknown): x is string => typeof x === 'string';
const isNum = (x: unknown): x is number =>
	typeof x === 'number' && Number.isSafeInteger(x) && x >= 0;
/** Unix seconds up to the year 9999, so every stored time formats as an RFC 3339 timestamp. */
const isTime = (x: unknown): x is number => isNum(x) && x <= 253_402_300_799;
const BUCKET = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const KEY_ID = /^[A-Z0-9]{16,128}$/;
const isBucket = (x: unknown): x is string => isStr(x) && BUCKET.test(x);
const unique = (xs: unknown[]) => new Set(xs).size === xs.length;
const tuple = (x: unknown, n: number): x is unknown[] => Array.isArray(x) && x.length === n;

/** Encodes the state as base64url JSON. */
export function encodeState(state: DemoState): string {
	const bytes = new TextEncoder().encode(JSON.stringify(state));
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Decodes a cookie value. Anything malformed, from an older version or over the size
 * limit gives the empty state: the cookie is only demo data, so starting over is safe.
 */
export function decodeState(value: string | undefined | null): DemoState {
	if (!value || value.length > MAX_STATE_BYTES) return emptyState();
	try {
		const bin = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
		const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
		const raw: unknown = JSON.parse(new TextDecoder().decode(bytes));
		return validState(raw) ? raw : emptyState();
	} catch {
		return emptyState();
	}
}

/**
 * Accepts only state this code could have written: well-formed names and IDs, bounded
 * times, no duplicates. Anything else would make the demo answer outside the contract.
 */
function validState(x: unknown): x is DemoState {
	if (typeof x !== 'object' || x === null) return false;
	const s = x as Record<string, unknown>;
	const arr = (v: unknown, item: (i: unknown) => boolean): v is unknown[] =>
		Array.isArray(v) && v.length <= 64 && v.every(item);
	const shape =
		s.v === 1 &&
		arr(s.b, (i) => tuple(i, 2) && isBucket(i[0]) && isTime(i[1])) &&
		arr(s.xb, isBucket) &&
		arr(
			s.k,
			(i) =>
				tuple(i, 4) &&
				isStr(i[0]) &&
				KEY_ID.test(i[0]) &&
				(i[1] === null || (isStr(i[1]) && i[1].length >= 1 && i[1].length <= 64)) &&
				arr(i[2], (g) => tuple(g, 2) && isBucket(g[0]) && (g[1] === 'r' || g[1] === 'rw')) &&
				unique((i[2] as unknown[][]).map((g) => g[0])) &&
				isTime(i[3])
		) &&
		arr(s.xk, (i) => isStr(i) && KEY_ID.test(i)) &&
		arr(
			s.o,
			(i) =>
				tuple(i, 5) &&
				isBucket(i[0]) &&
				isStr(i[1]) &&
				i[1].length >= 1 &&
				i[1].length <= 1024 &&
				isNum(i[2]) &&
				isStr(i[3]) &&
				isTime(i[4])
		) &&
		isTime(s.d) &&
		(s.t === undefined || isTime(s.t));
	if (!shape) return false;
	const st = s as unknown as DemoState;
	return (
		unique(st.b.map((b) => b[0])) &&
		unique(st.xb) &&
		unique(st.k.map((k) => k[0])) &&
		unique(st.xk) &&
		unique(st.o.map((o) => `${o[0]}/${o[1]}`))
	);
}

/** True when the encoded state fits in one cookie. */
export const fits = (state: DemoState) => encodeState(state).length <= MAX_STATE_BYTES;
