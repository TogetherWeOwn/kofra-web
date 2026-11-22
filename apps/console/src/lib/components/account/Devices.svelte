<script lang="ts">
	import { Button } from '@kofra/ui';
	import { deviceLabel } from '#lib/account-display.js';
	import { dateTime } from '#lib/format.js';
	import type { SessionRow } from '#lib/server/account/types.js';
	import type { ShownProblem } from '#lib/types.js';
	import Notice from '../Notice.svelte';
	import ProblemNotice from '../ProblemNotice.svelte';
	import ActionForm from './ActionForm.svelte';

	let {
		sessions,
		csrf,
		result
	}: {
		sessions: SessionRow[];
		csrf?: string;
		result: { revoked?: boolean; problem?: ShownProblem } | null;
	} = $props();
</script>

<section class="card pad" aria-labelledby="devices">
	<h2 id="devices">Signed-in devices</h2>
	<p>Review where you are signed in and end sessions you no longer need.</p>
	{#if result?.problem}<ProblemNotice problem={result.problem} />{/if}
	{#if result?.revoked}<Notice tone="success" live><p>Sign-out complete.</p></Notice>{/if}
	<div class="table-wrap">
		<table class="tbl" aria-labelledby="devices">
			<thead>
				<tr>
					<th scope="col">Device</th><th scope="col">Country</th><th scope="col">Last active</th><th
						scope="col"
					>
						Action
					</th>
				</tr>
			</thead>
			<tbody>
				{#each sessions as row (row.id)}
					<tr>
						<td>
							{deviceLabel(row.user_agent)}{#if row.current}
								<span class="badge">This device</span>{/if}
						</td>
						<td>{row.country ?? 'Unknown'}</td>
						<td>{dateTime(row.last_seen_at)}</td>
						<td>
							<ActionForm action="?/revoke" {csrf} styled={false}>
								<input type="hidden" name="id" value={row.id} />
								<button
									class="btn-plain btn-sm"
									aria-label="Sign out {row.current ? 'this device' : deviceLabel(row.user_agent)}"
								>
									Sign out
								</button>
							</ActionForm>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<ActionForm action="?/revokeOthers" {csrf}>
		<div class="actions"><Button type="submit">Sign out all other devices</Button></div>
	</ActionForm>
</section>
