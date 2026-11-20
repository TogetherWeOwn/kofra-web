<script lang="ts">
	import Upload from '@lucide/svelte/icons/upload';
	import { onDestroy } from 'svelte';
	import { invalidateAll } from '$app/navigation';
	import { bytes } from '#lib/format.js';
	import { uploadKey, validKey } from '#lib/paths.js';

	let { bucket, prefix }: { bucket: string; prefix: string } = $props();

	interface Item {
		id: number;
		key: string;
		size: number;
		sent: number;
		state: 'waiting' | 'uploading' | 'done' | 'failed';
		message?: string;
	}
	let items = $state<Item[]>([]);
	let dragging = $state(false);
	let announce = $state('');
	let next = 0;
	let input: HTMLInputElement;

	const active = $derived(items.some((i) => i.state === 'waiting' || i.state === 'uploading'));

	async function presign(key: string, size: number) {
		const res = await fetch(`/buckets/${encodeURIComponent(bucket)}/upload`, {
			method: 'POST',
			headers: { 'content-type': 'application/json', accept: 'application/json' },
			body: JSON.stringify({ key, size }),
			signal: controller.signal
		});
		const body = (await res.json().catch(() => ({}))) as {
			url?: string;
			method?: string;
			message?: string;
		};
		if (!res.ok || !body.url)
			throw new Error(body.message ?? `The upload could not start (${res.status}).`);
		return body as { url: string; method: string };
	}

	function put(item: Item, file: File, target: { url: string; method: string }) {
		return new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();
			current = xhr;
			xhr.open(target.method, target.url);
			if (file.type) xhr.setRequestHeader('content-type', file.type);
			xhr.upload.onprogress = (e) => (item.sent = e.loaded);
			xhr.onload = () => {
				if (xhr.status >= 200 && xhr.status < 300) return resolve();
				let msg = `The upload failed (${xhr.status}).`;
				try {
					msg = (JSON.parse(xhr.responseText) as { message?: string }).message ?? msg;
				} catch {
					/* keep the status message */
				}
				reject(new Error(msg));
			};
			xhr.onerror = () => reject(new Error('The connection dropped.'));
			xhr.onabort = () => reject(new Error('The upload was stopped.'));
			xhr.send(file);
		});
	}

	// One upload at a time, in the order picked: each upload's answer saves the demo state, so
	// overlapping uploads could overwrite each other's record. New picks join the queue.
	const queue: { id: number; file: File }[] = [];
	let running = false;
	let current: XMLHttpRequest | null = null;
	// Leaving the bucket page stops the upload in flight and drops the rest of the queue.
	let stopped = false;
	const controller = new AbortController();
	onDestroy(() => {
		stopped = true;
		queue.length = 0;
		controller.abort();
		current?.abort();
	});

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
				const target = await presign(it.key, file.size);
				// The visitor may have left while the address was being prepared.
				if (stopped) break;
				await put(it, file, target);
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
			They go into {prefix ? prefix : 'the top level of the bucket'}. The demo accepts files up to
			25 MB and keeps only their names and sizes.
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
