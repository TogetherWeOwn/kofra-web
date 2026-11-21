<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { bytes } from '#lib/format.js';
	import { uploadKey, validKey } from '#lib/paths.js';

	let {
		bucket,
		prefix,
		sample = false
	}: { bucket: string; prefix: string; sample?: boolean } = $props();

	interface Item {
		id: number;
		key: string;
		size: number;
		sent: number;
		state: 'waiting' | 'uploading' | 'done' | 'failed';
		message?: string;
	}
	/** One PUT of the whole file, or a plan to send it in parts (see FileStore.startUpload). */
	type Target =
		| { method: 'PUT'; url: string }
		| {
				method: 'MULTIPART';
				part_url: string;
				complete_url: string;
				abort_url: string;
				token: string;
				part_size: number;
				part_count: number;
		  };
	let items = $state<Item[]>([]);
	let dragging = $state(false);
	let announce = $state('');
	let next = 0;
	let input: HTMLInputElement;

	const active = $derived(items.some((i) => i.state === 'waiting' || i.state === 'uploading'));

	async function answer(res: Response, fallback: string) {
		const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
		if (!res.ok) throw new Error(typeof body.message === 'string' ? body.message : fallback);
		return body;
	}

	async function post(url: string, body: unknown) {
		const res = await fetch(url, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			// Not cancelled when the page navigates: an upload the server has just started must reach
			// the page, so it can still be stopped (see start()). Closing the tab during this request
			// can still leave one unfinished: once the bucket holds no file, its delete page can stop
			// it after 13 hours; otherwise an S3 tool can (abort-multipart-upload).
			body: JSON.stringify(body)
		});
		return answer(res, `The request failed (${res.status}).`);
	}

	async function presign(key: string, file: File): Promise<Target> {
		const body = await post(`/buckets/${encodeURIComponent(bucket)}/upload`, {
			key,
			size: file.size,
			type: file.type
		});
		if (body.method !== 'PUT' && body.method !== 'MULTIPART')
			throw new Error('The upload could not start.');
		return body as unknown as Target;
	}

	/** Sends one body; resolves with the answer's JSON. */
	function put(url: string, body: Blob, type: string, progress: (loaded: number) => void) {
		return new Promise<Record<string, unknown>>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			current = xhr;
			xhr.open('PUT', url);
			if (type) xhr.setRequestHeader('content-type', type);
			xhr.upload.onprogress = (e) => progress(e.loaded);
			xhr.onload = () => {
				let parsed: Record<string, unknown> = {};
				try {
					parsed = JSON.parse(xhr.responseText) as Record<string, unknown>;
				} catch {
					/* keep the status message */
				}
				if (xhr.status >= 200 && xhr.status < 300) return resolve(parsed);
				reject(
					new Error(
						typeof parsed.message === 'string'
							? parsed.message
							: `The upload failed (${xhr.status}).`
					)
				);
			};
			xhr.onerror = () => reject(new Error('The connection dropped.'));
			xhr.onabort = () => reject(new Error('The upload was stopped.'));
			xhr.send(body);
		});
	}

	/** The multipart upload in flight, so leaving the page can stop it on storage too. */
	let openUpload: Extract<Target, { method: 'MULTIPART' }> | null = null;

	/** Stops a multipart upload on storage; keepalive lets it finish while the page goes away. */
	function abortUpload(target: Extract<Target, { method: 'MULTIPART' }>) {
		fetch(target.abort_url, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ token: target.token }),
			keepalive: true
		}).catch(() => {});
	}

	async function send(item: Item, file: File, target: Target) {
		if (target.method === 'PUT') {
			await put(target.url, file, file.type, (n) => (item.sent = n));
			return;
		}
		openUpload = target;
		// Parts one after another; a failure stops the upload and drops the parts sent.
		const parts: { part: number; etag: string }[] = [];
		try {
			for (let n = 1; n <= target.part_count; n++) {
				const start = (n - 1) * target.part_size;
				const blob = file.slice(start, Math.min(start + target.part_size, file.size));
				const r = await put(
					`${target.part_url}&n=${n}`,
					blob,
					'application/octet-stream',
					(loaded) => (item.sent = start + loaded)
				);
				parts.push({ part: n, etag: String(r.etag ?? '') });
				if (stopped) throw new Error('The upload was stopped.');
			}
			await post(target.complete_url, { token: target.token, parts });
			openUpload = null;
		} catch (err) {
			// An unfinished upload is never cleared on its own: stop it, so its parts are dropped.
			if (openUpload) abortUpload(openUpload);
			openUpload = null;
			throw err;
		}
	}

	// One upload at a time, in the order picked. New picks join the queue.
	const queue: { id: number; file: File }[] = [];
	let running = false;
	let current: XMLHttpRequest | null = null;
	// Leaving the bucket page stops the upload in flight and drops the rest of the queue.
	let stopped = false;
	function leave() {
		stopped = true;
		queue.length = 0;
		current?.abort();
		if (openUpload) abortUpload(openUpload);
		openUpload = null;
	}
	onDestroy(leave);

	async function start(files: { file: File; path: string }[]) {
		for (const { file, path } of files) {
			const item: Item = {
				id: next++,
				key: uploadKey(prefix, path),
				size: file.size,
				sent: 0,
				state: 'waiting'
			};
			items = [...items, item];
			queue.push({ id: item.id, file });
		}
		if (running) return;
		running = true;
		let ok = 0;
		let failed = 0;
		announce = 'Uploading.';
		while (queue.length) {
			const { id, file } = queue.shift()!;
			// The proxied copy in `items`, so progress updates are reactive.
			const it = items.find((i) => i.id === id)!;
			if (!validKey(it.key)) {
				it.state = 'failed';
				it.message = 'That file name or path is not allowed.';
				failed++;
				continue;
			}
			it.state = 'uploading';
			try {
				const target = await presign(it.key, file);
				// The visitor may have left while the address was being prepared.
				if (stopped) {
					if (target.method === 'MULTIPART') abortUpload(target);
					break;
				}
				await send(it, file, target);
				it.state = 'done';
				it.sent = it.size;
				ok++;
			} catch (err) {
				it.state = 'failed';
				it.message = err instanceof Error ? err.message : 'The upload failed.';
				failed++;
			}
		}
		running = false;
		if (stopped) return;
		announce = `${ok} uploaded${failed ? `, ${failed} failed` : ''}.`;
		await invalidateAll();
	}

	function picked(e: Event) {
		const list = (e.currentTarget as HTMLInputElement).files;
		if (list?.length)
			start([...list].map((file) => ({ file, path: file.webkitRelativePath || file.name })));
		input.value = '';
	}

	async function dropped(e: DragEvent) {
		e.preventDefault();
		dragging = false;
		const files = [...(e.dataTransfer?.files ?? [])];
		if (files.length) start(files.map((file) => ({ file, path: file.name })));
	}
</script>

<svelte:window
	onbeforeunload={(e) => {
		if (active) e.preventDefault();
	}}
	onpagehide={leave}
	onpageshow={(e) => {
		// Back to a page restored from the browser's cache after leave(): start afresh.
		if (e.persisted && stopped) location.reload();
	}}
/>

<section class="card pad up" aria-labelledby="up-h">
	<h2 id="up-h">Upload files</h2>
	<div
		class="drop"
		class:dragging
		role="group"
		aria-label="Upload area"
		ondragover={(e) => {
			e.preventDefault();
			dragging = true;
		}}
		ondragleave={() => (dragging = false)}
		ondrop={dropped}
	>
		<Upload class="icon" aria-hidden="true" />
		<p>Drop files here, or</p>
		<label class="btn-plain btn-sm pick">
			Choose files
			<input bind:this={input} class="sr-only" type="file" multiple onchange={picked} />
		</label>
		<p class="muted">
			They go into {prefix ? prefix : 'the top level of the bucket'}.
			{#if sample}
				The demo accepts files up to 25 MB and keeps only their names and sizes.
			{:else}
				A file with the same name is never replaced: delete it first.
			{/if}
		</p>
	</div>
	<p class="sr-only" role="status">{announce}</p>
	{#if items.length}
		<ul class="list">
			{#each items as it (it.id)}
				<li>
					<span class="name mono">{it.key}</span>
					<progress
						max={it.size || 1}
						value={it.state === 'done' ? it.size || 1 : it.sent}
						aria-label="Progress of {it.key}"
					></progress>
					<span class="st" class:bad={it.state === 'failed'}>
						{#if it.state === 'done'}Uploaded, {bytes(it.size)}
						{:else if it.state === 'failed'}Failed: {it.message}
						{:else if it.state === 'uploading'}{bytes(it.sent)} of {bytes(it.size)}
						{:else}Waiting{/if}
					</span>
				</li>
			{/each}
		</ul>
	{/if}
	<noscript>
		<p>Uploading from the browser needs JavaScript. Any S3 tool works without it.</p>
	</noscript>
</section>

<style>
	.drop {
		border: 1px dashed var(--color-border-strong);
		border-radius: var(--radius-md);
		padding: var(--space-5);
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--space-2) var(--space-3);
		background: var(--color-band);
	}
	.drop.dragging {
		border-color: var(--color-accent);
		background: var(--color-accent-soft);
	}
	.drop .muted {
		flex-basis: 100%;
		font-size: var(--font-size-sm);
	}
	.pick:focus-within {
		outline: 2px solid var(--color-focus);
		outline-offset: 2px;
	}
	.list {
		display: grid;
		gap: var(--space-2);
		font-size: var(--font-size-sm);
	}
	.list li {
		display: grid;
		grid-template-columns: minmax(0, 2fr) minmax(80px, 1fr) minmax(0, 2fr);
		gap: var(--space-3);
		align-items: center;
	}
	.name {
		overflow-wrap: anywhere;
	}
	progress {
		width: 100%;
		accent-color: var(--color-accent);
	}
	.st.bad {
		color: var(--color-danger);
	}
	@media (max-width: 640px) {
		.list li {
			grid-template-columns: minmax(0, 1fr);
			gap: var(--space-1);
		}
	}
</style>
