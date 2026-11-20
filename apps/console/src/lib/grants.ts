import type { Grant } from '@kofra/api';

export type Access = Grant['access'];

/** "Read and write: backups · Read only: photos, projects" */
export function grantSummary(grants: Grant[]): string {
	const rw = grants.filter((g) => g.access === 'read_write').map((g) => g.bucket);
	const r = grants.filter((g) => g.access === 'read').map((g) => g.bucket);
	const known = new Set(['read', 'read_write']);
	const other = grants.filter((g) => !known.has(g.access)).map((g) => g.bucket);
	return [
		rw.length ? `Read and write: ${rw.join(', ')}` : '',
		r.length ? `Read only: ${r.join(', ')}` : '',
		other.length ? `Other access: ${other.join(', ')}` : ''
	]
		.filter(Boolean)
		.join(' · ');
}

/** Grants from the create form: one `access:<bucket>` field per bucket, "none" by default. */
export function grantsFromForm(form: FormData, buckets: string[]): Grant[] {
	const out: Grant[] = [];
	for (const bucket of buckets) {
		const v = form.get(`access:${bucket}`);
		if (v === 'read' || v === 'read_write') out.push({ bucket, access: v });
	}
	return out;
}
