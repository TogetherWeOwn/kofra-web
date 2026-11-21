<script lang="ts">
	import { deviceLabel, eventLabel } from '#lib/account-display.js';
	import { dateTime } from '#lib/format.js';
	import type { SecurityEvent } from '#lib/server/account/types.js';

	let { events }: { events: SecurityEvent[] } = $props();
</script>

<section class="card pad" aria-labelledby="security">
	<h2 id="security">Recent security activity</h2>
	<p>Review the last 50 security events on your account.</p>
	{#if events.length}
		<div class="table-wrap">
			<table class="tbl" aria-labelledby="security">
				<thead>
					<tr>
						<th scope="col">Activity</th><th scope="col">Device</th><th scope="col">Country</th><th
							scope="col"
						>
							Time
						</th>
					</tr>
				</thead>
				<tbody>
					{#each events.slice(0, 50) as event, i (i)}
						<tr>
							<td>{eventLabel(event.kind)}</td><td>{deviceLabel(event.user_agent)}</td>
							<td>{event.country ?? 'Unknown'}</td><td>{dateTime(event.at)}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{:else}
		<p>No security activity yet.</p>
	{/if}
</section>
