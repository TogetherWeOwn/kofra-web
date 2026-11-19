<script lang="ts">
	import Database from '@lucide/svelte/icons/database';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Plus from '@lucide/svelte/icons/plus';
	import ReceiptText from '@lucide/svelte/icons/receipt-text';
	import Settings from '@lucide/svelte/icons/settings';

	// Sample data for the illustration only.
	const buckets = [
		{ name: 'family-photos', size: '1.42 TB', objects: '48,210', access: 'Private' },
		{ name: 'laptop-backups', size: '612.4 GB', objects: '9,844', access: 'Private' },
		{ name: 'drive-archive', size: '318.0 GB', objects: '27,503', access: 'Private' },
		{ name: 'client-deliveries', size: '84.2 GB', objects: '1,206', access: 'Private' },
		{ name: 'website-assets', size: '2.1 GB', objects: '3,391', access: 'Private' }
	];
	const nav = [
		{ label: 'Buckets', icon: Database, on: true },
		{ label: 'Access keys', icon: KeyRound, on: false },
		{ label: 'Usage and billing', icon: ReceiptText, on: false },
		{ label: 'Settings', icon: Settings, on: false }
	];
</script>

<!-- A static picture of the console's buckets screen, drawn in HTML. Inert: one image to assistive technology. -->
<div
	data-twin-skip
	class="shot"
	role="img"
	aria-label="Illustration of the Kofra console: a list of five buckets with their sizes and object counts."
>
	<div class="win" aria-hidden="true">
		<div class="side">
			<div class="brand">
				<svg class="mark" viewBox="0 0 24 24" width="18" height="18" focusable="false">
					<rect x="2" y="2" width="20" height="20" rx="4" fill="currentColor" /><path
						d="M8 6.5v11M8 12l6.5-5.5M10.2 10.2 15.5 17.5"
						stroke-width="2.2"
						fill="none"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg><span>Kofra</span>
			</div>
			<div class="nav">
				{#each nav as item (item.label)}
					{@const Icon = item.icon}
					<span class:on={item.on}><Icon size={14} strokeWidth={1.75} />{item.label}</span>
				{/each}
			</div>
		</div>
		<div class="main">
			<div class="top"><span>Buckets</span><span class="av">AK</span></div>
			<div class="head">
				<span class="h1">Buckets</span><span class="btn">
					<Plus size={13} strokeWidth={1.75} />Create bucket
				</span>
			</div>
			<div class="table">
				<div class="tr th">
					<span>Name</span><span>Size</span><span>Objects</span><span>Access</span>
				</div>
				{#each buckets as b (b.name)}
					<div class="tr">
						<span class="name"><Database size={13} strokeWidth={1.75} />{b.name}</span><span>
							{b.size}
						</span><span>{b.objects}</span><span>{b.access}</span>
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>

<style>
	.shot {
		font-size: 12px;
		line-height: 1.4;
		pointer-events: none;
		user-select: none;
	}
	.win {
		display: grid;
		grid-template-columns: 150px 1fr;
		background: var(--color-surface);
		border: 1px solid var(--color-line);
		border-radius: var(--radius-lg);
		overflow: hidden;
		box-shadow: var(--shadow-raised);
	}
	.side {
		background: var(--color-band);
		border-right: 1px solid var(--color-line);
		padding: 14px 10px;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 6px;
		font-weight: var(--font-weight-semibold);
		font-size: 13px;
		margin-bottom: 18px;
	}
	.mark {
		color: var(--color-accent);
	}
	.mark path {
		stroke: var(--color-mark-ink);
	}
	.nav {
		display: grid;
		gap: 2px;
		color: var(--color-ink-2);
	}
	.nav span {
		display: flex;
		align-items: center;
		gap: 7px;
		padding: 6px 8px;
		border-radius: var(--radius-sm);
	}
	.nav .on {
		background: var(--color-surface);
		color: var(--color-ink);
		font-weight: var(--font-weight-semibold);
		box-shadow: inset 2px 0 0 var(--color-accent);
	}
	.main {
		min-width: 0;
	}
	.top {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 9px 16px;
		border-bottom: 1px solid var(--color-line);
		color: var(--color-muted);
	}
	.av {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--color-surface-2);
		color: var(--color-ink-2);
		display: grid;
		place-items: center;
		font-size: 10px;
		font-weight: var(--font-weight-semibold);
	}
	.head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px 16px 12px;
	}
	.h1 {
		font-size: 17px;
		font-weight: var(--font-weight-semibold);
	}
	.btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		background: var(--color-accent);
		color: var(--color-accent-ink);
		border-radius: var(--radius-sm);
		padding: 5px 10px;
		font-weight: var(--font-weight-medium);
	}
	.table {
		margin: 0 16px 16px;
		border: 1px solid var(--color-line);
		border-radius: var(--radius-md);
		overflow: hidden;
	}
	.tr {
		display: grid;
		grid-template-columns: 1.6fr 0.8fr 0.8fr 0.9fr;
		gap: 8px;
		padding: 8px 12px;
		border-top: 1px solid var(--color-line);
		white-space: nowrap;
	}
	.tr span {
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.th {
		border-top: 0;
		background: var(--color-band);
		color: var(--color-muted);
		font-weight: var(--font-weight-semibold);
	}
	.name {
		display: flex;
		align-items: center;
		gap: 6px;
		color: var(--color-accent-text);
		font-weight: var(--font-weight-medium);
	}
	.name :global(svg) {
		color: var(--color-muted);
		flex: none;
	}
	@media (max-width: 640px) {
		.win {
			grid-template-columns: 1fr;
		}
		.side {
			display: none;
		}
		.tr {
			grid-template-columns: 1.6fr 0.9fr 0.9fr;
		}
		.tr span:nth-child(4) {
			display: none;
		}
	}
</style>
