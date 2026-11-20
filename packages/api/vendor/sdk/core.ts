// Hand-written core of the TypeScript SDK: authentication, base URL, retries,
// idempotency keys and errors. The per-operation layer (operations.ts) and the
// types (schema.ts) are generated from the contract.

/** RFC 9457 problem details as the Kofra API returns them. */
export interface Problem {
	type: string;
	title: string;
	status: number;
	code: string;
	detail: string;
	hint: string;
	docs_url: string;
	request_id: string;
	retryable: boolean;
	errors?: { pointer: string; code: string; detail: string }[];
}

/** Any non-2xx answer. Branch on `code`; `hint` says what to do next. */
export class KofraError extends Error {
	readonly status: number;
	readonly code: string;
	readonly hint: string;
	readonly docsUrl: string;
	readonly requestId: string;
	readonly retryable: boolean;
	readonly problem: Problem;

	constructor(problem: Problem) {
		super(`${problem.code}: ${problem.detail}`);
		this.name = 'KofraError';
		this.status = problem.status;
		this.code = problem.code;
		this.hint = problem.hint;
		this.docsUrl = problem.docs_url;
		this.requestId = problem.request_id;
		this.retryable = problem.retryable;
		this.problem = problem;
	}
}

export interface ClientOptions {
	/** API token. Defaults to the `KOFRA_API_TOKEN` environment variable. */
	token?: string;
	/** Defaults to `KOFRA_API_URL`, then `https://api.kofra.app`. */
	baseUrl?: string;
	/**
	 * Allow a plain-http base URL on a host other than localhost, 127.0.0.0/8
	 * or ::1. Default false: the token would cross the network unencrypted.
	 */
	allowInsecureHttp?: boolean;
	/** Retries of 429, 503 and 409 `idempotency_key_in_use` answers and network failures. Default 2. */
	maxRetries?: number;
	/** Longest wait between retries, in seconds. Default 30. A Retry-After above it stops the retries. */
	maxRetryWaitSeconds?: number;
	/** A fetch implementation; defaults to the global one. */
	fetch?: typeof fetch;
}

export interface CallOptions {
	/** Sent on POST, PATCH and DELETE; a random one is used when absent. */
	idempotencyKey?: string;
	signal?: AbortSignal;
}

type Args = Record<string, unknown> & { body?: unknown };

const env = (name: string): string | undefined =>
	(globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[name];

const sleep = (ms: number, signal?: AbortSignal) =>
	new Promise<void>((resolve, reject) => {
		if (signal?.aborted) return reject(signal.reason);
		const onAbort = () => {
			clearTimeout(t);
			reject(signal?.reason);
		};
		const t = setTimeout(() => {
			signal?.removeEventListener('abort', onAbort);
			resolve();
		}, ms);
		signal?.addEventListener('abort', onAbort, { once: true });
	});

export class Core {
	readonly baseUrl: string;
	readonly #token: string;
	readonly #maxRetries: number;
	readonly #maxWait: number;
	readonly #fetch: typeof fetch;

	constructor(options: ClientOptions = {}) {
		const token = options.token ?? env('KOFRA_API_TOKEN');
		if (!token) throw new Error('Kofra: no API token; pass `token` or set KOFRA_API_TOKEN.');
		this.#token = token;
		this.baseUrl = trimTrailingSlashes(
			options.baseUrl ?? env('KOFRA_API_URL') ?? 'https://api.kofra.app'
		);
		checkBaseUrl(this.baseUrl, options.allowInsecureHttp ?? false);
		this.#maxRetries = options.maxRetries ?? 2;
		this.#maxWait = options.maxRetryWaitSeconds ?? 30;
		// NaN or Infinity would never exhaust the retry loop.
		if (!Number.isSafeInteger(this.#maxRetries) || this.#maxRetries < 0)
			throw new Error('Kofra: `maxRetries` must be a non-negative integer.');
		if (!Number.isFinite(this.#maxWait) || this.#maxWait < 0)
			throw new Error('Kofra: `maxRetryWaitSeconds` must be a non-negative finite number.');
		this.#fetch = options.fetch ?? globalThis.fetch.bind(globalThis);
	}

	/** One operation: builds the request, retries busy answers, maps errors. */
	async call(
		method: string,
		pathTemplate: string,
		args: Args,
		pathNames: string[],
		queryNames: string[],
		options: CallOptions = {}
	): Promise<unknown> {
		let path = pathTemplate;
		for (const name of pathNames) {
			const value = args[name];
			if (value === undefined || value === null) throw new Error(`Kofra: \`${name}\` is required.`);
			if (['', '.', '..'].includes(String(value)))
				throw new Error(`Kofra: ${JSON.stringify(String(value))} is not a valid path argument.`);
			path = path.replace(`{${name}}`, encodeURIComponent(String(value)));
		}
		const url = new URL(this.baseUrl + path);
		for (const name of queryNames) {
			const value = args[name];
			if (value !== undefined && value !== null) url.searchParams.set(name, String(value));
		}
		const headers: Record<string, string> = {
			authorization: `Bearer ${this.#token}`,
			accept: 'application/json'
		};
		if (method !== 'GET')
			headers['idempotency-key'] = options.idempotencyKey ?? crypto.randomUUID();
		let body: string | undefined;
		if (args.body !== undefined) {
			headers['content-type'] = 'application/json';
			body = JSON.stringify(args.body);
		}

		for (let attempt = 0; ; attempt++) {
			let res: Response;
			try {
				// Redirects are not followed: fetch would turn a redirected write
				// into a GET whose 200 could pass as the write's result.
				res = await this.#fetch(url, {
					method,
					headers,
					body,
					signal: options.signal,
					redirect: 'manual'
				});
			} catch (err) {
				if (attempt >= this.#maxRetries || options.signal?.aborted) throw err;
				await sleep(Math.min(0.5 * 2 ** attempt, this.#maxWait) * 1000, options.signal);
				continue;
			}
			let text: string;
			try {
				text = await res.text();
			} catch (err) {
				// The body broke off after the headers. A busy answer (429, 503) is
				// retryable on its status alone, so the lost body does not use up
				// the call; anything else, or an abort, surfaces the read error.
				const busy = res.status === 429 || res.status === 503;
				if (!busy || attempt >= this.#maxRetries || options.signal?.aborted) throw err;
				const wait = this.#backoff(attempt, res.headers.get('retry-after'));
				if (wait === null) throw err;
				await sleep(wait, options.signal);
				continue;
			}
			if (res.ok) return text ? JSON.parse(text) : undefined;
			const problem = toProblem(res, text);
			if (attempt < this.#maxRetries && isRetryable(res.status, problem)) {
				const wait = this.#backoff(attempt, res.headers.get('retry-after'));
				if (wait !== null) {
					await sleep(wait, options.signal);
					continue;
				}
			}
			throw new KofraError(problem);
		}
	}

	/** Milliseconds before the next attempt, or null when the server asks for longer than the max wait. */
	#backoff(attempt: number, retryAfter: string | null): number | null {
		const asked = retryAfterSeconds(retryAfter);
		if (asked !== null) return asked <= this.#maxWait ? asked * 1000 : null;
		return Math.min(0.5 * 2 ** attempt, this.#maxWait) * 1000;
	}
}

/** Drops trailing "/" in linear time (a `/\/+$/` regex is quadratic on long runs of "/"). */
function trimTrailingSlashes(url: string): string {
	let end = url.length;
	while (end > 0 && url[end - 1] === '/') end--;
	return url.slice(0, end);
}

/** Seconds from a Retry-After header: delta-seconds or an HTTP date. */
function retryAfterSeconds(value: string | null): number | null {
	if (!value) return null;
	const v = value.trim();
	if (/^\d+$/.test(v)) return Number(v);
	const when = Date.parse(v);
	if (Number.isNaN(when)) return null;
	return Math.max((when - Date.now()) / 1000, 0);
}

function isRetryable(status: number, problem: Problem): boolean {
	return (
		status === 429 ||
		status === 503 ||
		(status === 409 && problem.code === 'idempotency_key_in_use')
	);
}

function checkBaseUrl(baseUrl: string, allowInsecureHttp: boolean): void {
	let url: URL | undefined;
	try {
		url = new URL(baseUrl);
	} catch {
		// Reported below.
	}
	if (url?.protocol === 'https:' && url.hostname) return;
	if (url?.protocol === 'http:' && url.hostname && (allowInsecureHttp || isLoopback(url.hostname)))
		return;
	throw new Error(
		`Kofra: the base URL ${JSON.stringify(baseUrl)} must use https (plain http only for localhost, 127.0.0.0/8 or ::1, or with allowInsecureHttp).`
	);
}

function isLoopback(hostname: string): boolean {
	const host = hostname.replace(/^\[|\]$/g, '');
	return host === 'localhost' || host === '::1' || /^127(\.\d{1,3}){3}$/.test(host);
}

function toProblem(res: Response, text: string): Problem {
	try {
		const p = JSON.parse(text) as Problem;
		if (p && typeof p.code === 'string') return p;
	} catch {
		// Not a problem body; fall through.
	}
	return {
		type: 'about:blank',
		title: res.statusText || 'HTTP error',
		status: res.status,
		code: `http_${res.status}`,
		detail: `The API answered HTTP ${res.status} without a problem body.`,
		hint: 'Retry later; if it persists, contact support with the Kofra-Request-Id header.',
		docs_url: 'https://kofra.app/docs/errors/index.md',
		request_id: res.headers.get('kofra-request-id') ?? '',
		retryable: res.status === 429 || res.status === 503
	};
}
