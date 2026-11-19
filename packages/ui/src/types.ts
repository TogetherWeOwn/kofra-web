import type { LucideIcon } from '@lucide/svelte';

/** A Lucide icon component (ISC licence). Always decorative: the text next to it carries the meaning. */
export type IconComponent = LucideIcon;

export interface NavItem {
	label: string;
	href: string;
}

export interface FooterColumn {
	heading: string;
	links: NavItem[];
}

export interface Plan {
	id: string;
	name: string;
	/** Price as shown, for example "$6". */
	price: string;
	/** Unit next to the price, for example "per TB a month". */
	unit: string;
	blurb: string;
	cta: NavItem;
	features: string[];
	/** Draws the plan with the accent border and a primary button. At most one plan should set it. */
	featured?: boolean;
}

/** One comparison row: a label and one value per plan. `true` / `false` render as an icon plus hidden text. */
export interface CompareRow {
	label: string;
	values: (string | boolean)[];
}

export interface Feature {
	icon: IconComponent;
	title: string;
	body: string;
}

export interface Tool {
	name: string;
	icon: IconComponent;
	/** Shown after the name, for example "coming soon". */
	note?: string;
}

export interface FaqItem {
	q: string;
	a: string;
}

export type HeadingLevel = 2 | 3 | 4;
