// Launch wiring (account links, status link, switches) and the documented client profile.
// The switches are compile-time constants; this suite checks the default (staging) build. The
// switched-on build is checked in CI by scripts/check-launch.mjs.
import { describe, expect, it } from 'vitest';
import { EARLY_ACCESS, ENDPOINT, FOOTER, PLANS, PRIMARY_CTA, PROFILE } from './content';
import { PAGES } from './registry';
import { AWS_CLI_BLOCKS } from './pages/aws-cli';
import { RCLONE_BLOCKS } from './pages/rclone';
import {
	SIGN_IN_URL,
	SIGN_UP_URL,
	SIGNUP_OPEN,
	STATUS_LIVE,
	STATUS_NOTE,
	STATUS_URL
} from './site';
import type { Block } from './blocks';

const links = FOOTER.flatMap((c) => c.links);
const code = (blocks: Block[]) =>
	blocks.flatMap((b) => (b.type === 'code' ? [b.code] : [])).join('\n');

describe('launch switches, default build', () => {
	it('keeps sign-ups and the status page off', () => {
		expect(SIGNUP_OPEN).toBe(false);
		expect(STATUS_LIVE).toBe(false);
	});

	it('points the main call to action and every plan at early access', () => {
		expect(PRIMARY_CTA).toEqual({ label: 'Get early access', href: EARLY_ACCESS });
		for (const p of PLANS) expect(p.cta.href, p.id).toBe(EARLY_ACCESS);
		expect(links.some((l) => l.href === SIGN_UP_URL)).toBe(false);
	});

	it('always links sign-in to the console', () => {
		expect(SIGN_IN_URL).toBe('https://console.kofra.app/sign-in');
		expect(links).toContainEqual({ label: 'Sign in', href: SIGN_IN_URL });
	});

	it('does not link the status page until it is live', () => {
		expect(STATUS_URL).toBe('https://status.kofra.app');
		expect(links.some((l) => l.href === STATUS_URL)).toBe(false);
	});

	it('says early access and example prices in the footer', () => {
		expect(STATUS_NOTE).toBe('Kofra is in early access. Prices shown are examples.');
	});
});

describe('documented client profile', () => {
	it('uses the customer endpoint everywhere', () => {
		expect(ENDPOINT).toBe('https://s3.kofra.io');
		for (const p of PAGES) expect(p.markdown(), p.path).not.toContain('s3.kofra.app');
	});

	it('matches the measured limits', () => {
		// 16 MiB parts, 10,000 per object; requests up to 99 MiB (bodies above 100 MiB are
		// refused at the edge); parts above 16 MiB are stored in 8 MiB slices.
		expect(PROFILE.partMiB).toBe(16);
		expect(PROFILE.concurrency).toBe(16);
		expect(PROFILE.maxRequestMiB).toBe(99);
		expect(PROFILE.maxObjectGiB).toBe(Math.floor((10_000 * 16) / 1024));
		expect(PROFILE.maxObjectLargePartsGiB).toBe(Math.floor((10_000 * 8) / 1024));
		expect(PROFILE.maxObjectSmallPartsGiB).toBe(Math.floor((10_000 * 5) / 1024));
	});

	it('sets the full aws-cli profile', () => {
		const c = code(AWS_CLI_BLOCKS);
		for (const line of [
			'endpoint_url = https://s3.kofra.io',
			'addressing_style = path',
			'multipart_threshold = 16MB',
			'multipart_chunksize = 16MB',
			'max_concurrent_requests = 16',
			'preferred_transfer_client = classic'
		])
			expect(c).toContain(line);
	});

	it('sets the full rclone remote', () => {
		const c = code(RCLONE_BLOCKS);
		for (const line of [
			'force_path_style = true',
			'upload_cutoff = 16M',
			'chunk_size = 16M',
			'upload_concurrency = 1',
			'disable_http2 = true',
			'--transfers 16'
		])
			expect(c).toContain(line);
	});
});
