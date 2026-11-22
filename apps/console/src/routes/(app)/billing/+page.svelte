<script lang="ts">
	import Csrf from '#lib/components/account/Csrf.svelte';
	import CreditCard from '@lucide/svelte/icons/credit-card';
	import Notice from '#lib/components/Notice.svelte';
	import ProblemNotice from '#lib/components/ProblemNotice.svelte';
	import { bytes } from '#lib/format.js';

	let { data, form } = $props();
	const l = $derived(data.limits);
</script>

<svelte:head>
	<title>Billing: Kofra console</title>
	<meta name="description" content="Your Kofra plan, payment details and invoices." />
</svelte:head>

<div class="ph">
	<div>
		<h1>Billing</h1>
		<p>Your plan, payment details and invoices.</p>
	</div>
</div>

{#if form?.problem}<ProblemNotice problem={form.problem} />{/if}
{#if data.checkout === 'done'}
	<Notice tone="success" title="Checkout finished" live>
		<p>This was a test-mode payment: nothing was charged, and the demo plan stays as it is.</p>
	</Notice>
{:else if data.checkout === 'cancelled'}
	<Notice tone="info" title="Checkout cancelled" live><p>Nothing was charged.</p></Notice>
{/if}
{#if data.billing.enabled}
	<Notice tone="warning" title="Test mode">
		<p>Payments here use test mode: use a test card, and nothing is charged.</p>
	</Notice>
{:else}
	<Notice tone="info" title="Billing is not connected yet">
		<p>
			{data.billing.reason} Plans and payments open with the first release; until then nothing is charged.
		</p>
	</Notice>
{/if}

<div class="two">
	<section class="card pad" aria-labelledby="plan-h">
		<h2 id="plan-h">Plan</h2>
		<p class="big">Storage plan</p>
		<dl class="kv">
			<dt>Storage</dt>
			<dd>{l.storage_bytes === null ? 'No limit' : bytes(l.storage_bytes)}</dd>
			<dt>Uploads per 24 hours</dt>
			<dd>{l.upload_24h_bytes === null ? 'No limit' : bytes(l.upload_24h_bytes)}</dd>
			<dt>Downloads included per month</dt>
			<dd>
				{l.download_allowance_bytes === null
					? 'No allowance applies'
					: bytes(l.download_allowance_bytes)}
			</dd>
			<dt>Access keys</dt>
			<dd>Up to {l.active_keys}</dd>
			<dt>Price</dt>
			<dd>Set at launch</dd>
		</dl>
		<form method="POST" action="?/checkout">
			<Csrf />
			<button class="btn-plain" type="submit" disabled={!data.billing.enabled}>
				Choose this plan
			</button>
		</form>
	</section>
	<section class="card pad" aria-labelledby="pay-h">
		<h2 id="pay-h">Payment details</h2>
		<p class="big"><CreditCard class="icon" aria-hidden="true" />No payment method</p>
		<p class="muted">
			Cards, invoices, tax details and cancellation are managed on a secure page run by our payment
			provider. Card numbers never reach Kofra.
		</p>
		<form method="POST" action="?/portal">
			<Csrf />
			<button class="btn-plain" type="submit" disabled={!data.billing.portal}>
				Manage payment details
			</button>
		</form>
	</section>
</div>

<section class="card" aria-labelledby="inv-h">
	<div class="card-bar"><h2 id="inv-h" class="h3">Invoices</h2></div>
	<p class="empty muted">No invoices yet.</p>
</section>

<style>
	.big {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		font-size: var(--font-size-xl);
		font-weight: var(--font-weight-semibold);
	}
	.empty {
		padding: var(--space-6) var(--space-4);
	}
</style>
