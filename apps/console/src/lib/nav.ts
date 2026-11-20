import Activity from '@lucide/svelte/icons/chart-column';
import Database from '@lucide/svelte/icons/database';
import KeyRound from '@lucide/svelte/icons/key-round';
import LayoutDashboard from '@lucide/svelte/icons/layout-dashboard';
import Receipt from '@lucide/svelte/icons/receipt-text';
import Settings from '@lucide/svelte/icons/settings';
import type { Component } from 'svelte';
import { resolve } from '$app/paths';
import type { ResolvedPathname } from '$app/types';

export interface NavEntry {
	label: string;
	href: ResolvedPathname;
	icon: Component<{ class?: string; 'aria-hidden'?: boolean | 'true' }>;
}

export const NAV: NavEntry[] = [
	{ label: 'Overview', href: resolve('/(app)'), icon: LayoutDashboard as NavEntry['icon'] },
	{ label: 'Buckets', href: resolve('/(app)/buckets'), icon: Database as NavEntry['icon'] },
	{ label: 'Access keys', href: resolve('/(app)/keys'), icon: KeyRound as NavEntry['icon'] },
	{ label: 'Usage', href: resolve('/(app)/usage'), icon: Activity as NavEntry['icon'] },
	{ label: 'Billing', href: resolve('/(app)/billing'), icon: Receipt as NavEntry['icon'] },
	{ label: 'Settings', href: resolve('/(app)/settings'), icon: Settings as NavEntry['icon'] }
];

/** The nav entry a path belongs to: the overview only for "/", others by prefix. */
export function currentEntry(path: string): NavEntry | undefined {
	if (path === '/') return NAV[0];
	return NAV.slice(1).find((e) => path === e.href || path.startsWith(`${e.href}/`));
}

export interface Crumb {
	label: string;
	href?: ResolvedPathname;
}

export const DOCS_URL = 'https://kofra.app/docs';
/** Licences of the fonts and icons the console ships (served by the marketing site). */
export const LICENCES_URL = 'https://kofra.app/licences';
