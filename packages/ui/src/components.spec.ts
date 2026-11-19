import Check from '@lucide/svelte/icons/check';
import Terminal from '@lucide/svelte/icons/terminal';
import { describe, expect, it } from 'vitest';
import Button from './Button.svelte';
import Callout from './Callout.svelte';
import CodeBlock from './CodeBlock.svelte';
import ComparisonTable from './ComparisonTable.svelte';
import FAQ from './FAQ.svelte';
import FeatureGrid from './FeatureGrid.svelte';
import Footer from './Footer.svelte';
import Link from './Link.svelte';
import Logo from './Logo.svelte';
import Nav from './Nav.svelte';
import PricingTable from './PricingTable.svelte';
import ThemeToggle from './ThemeToggle.svelte';
import ToolBadges from './ToolBadges.svelte';
import { audit, html } from './test/audit.js';
import type { Plan } from './types.js';

const q = (doc: ParentNode, sel: string) => {
	const el = doc.querySelector(sel);
	if (!el) throw new Error(`no element matches ${sel}`);
	return el;
};
const all = (doc: ParentNode, sel: string) => [...doc.querySelectorAll(sel)];
const text = (el: Element) => el.textContent?.replace(/\s+/g, ' ').trim();

describe('Button', () => {
	it('renders a link when given href, with no axe violations', async () => {
		const a = await audit(Button, { href: '/pricing', children: html('View pricing') });
		expect(a.violations).toEqual([]);
		const link = q(a.document, 'a');
		expect(link.getAttribute('href')).toBe('/pricing');
		expect(link.className).toContain('primary');
		expect(a.document.querySelector('button')).toBeNull();
	});

	it('renders a type=button button without href, and keeps an explicit type', async () => {
		const a = await audit(Button, { variant: 'secondary', children: html('Save') });
		expect(a.violations).toEqual([]);
		expect(q(a.document, 'button').getAttribute('type')).toBe('button');
		const s = await audit(Button, { type: 'submit', children: html('Join') });
		expect(q(s.document, 'button').getAttribute('type')).toBe('submit');
	});
});

describe('Link', () => {
	it('adds a decorative arrow to the arrow variant only', async () => {
		const a = await audit(Link, {
			href: '/docs',
			variant: 'arrow',
			children: html('Read the docs')
		});
		expect(a.violations).toEqual([]);
		expect(text(q(a.document, 'a'))).toBe('Read the docs');
		expect(q(a.document, 'a svg').getAttribute('aria-hidden')).toBe('true');
		const plain = await audit(Link, { href: '/docs', children: html('docs') });
		expect(plain.document.querySelector('a svg')).toBeNull();
	});
});

describe('Logo', () => {
	it('is a home link named "Kofra home" with a hidden mark', async () => {
		const a = await audit(Logo, {});
		expect(a.violations).toEqual([]);
		const link = q(a.document, 'a');
		expect(link.getAttribute('aria-label')).toBe('Kofra home');
		expect(link.getAttribute('href')).toBe('/');
		expect(q(a.document, 'svg').getAttribute('aria-hidden')).toBe('true');
		// The mark is styled by class, never an inline style (the site's CSP forbids them).
		expect(a.html).not.toMatch(/style=/);
	});
});

describe('Nav', () => {
	const items = [
		{ label: 'Product', href: '/' },
		{ label: 'Pricing', href: '/pricing' },
		{ label: 'Docs', href: '/docs' }
	];

	it('marks the current section and passes axe as the page banner', async () => {
		const a = await audit(
			Nav,
			{
				items,
				current: '/docs/rclone',
				actions: html('<a href="/early-access">Get early access</a>')
			},
			{ landmark: 'page' }
		);
		expect(a.violations).toEqual([]);
		const current = all(a.document, '[aria-current="page"]').map(text);
		// Desktop list and phone menu each mark the same item.
		expect(current).toEqual(['Docs', 'Docs']);
		expect(all(a.document, 'nav[aria-label="Main"]')).toHaveLength(2);
	});

	it('uses a native disclosure for the phone menu', async () => {
		const a = await audit(Nav, { items, current: '/' }, { landmark: 'page' });
		expect(text(q(a.document, 'details > summary'))).toBe('Menu');
		expect(all(a.document, '[aria-current="page"]').map(text)).toEqual(['Product', 'Product']);
	});
});

describe('Footer', () => {
	it('renders headed link columns and the bottom row', async () => {
		const a = await audit(
			Footer,
			{
				tagline: 'S3-compatible cloud storage.',
				columns: [
					{ heading: 'Product', links: [{ label: 'Pricing', href: '/pricing' }] },
					{ heading: 'Legal', links: [{ label: 'Terms', href: '/legal/terms' }] }
				],
				bottom: html('<p>© 2026 Kofra</p>')
			},
			{ landmark: 'page' }
		);
		expect(a.violations).toEqual([]);
		expect(all(a.document, 'footer h2').map(text)).toEqual(['Product', 'Legal']);
		expect(text(q(a.document, 'footer'))).toContain('© 2026 Kofra');
	});
});

describe('PricingTable', () => {
	const plans: Plan[] = [
		{
			id: 'free',
			name: 'Free',
			price: '$0',
			unit: 'up to 25 GB',
			blurb: 'Try it.',
			cta: { label: 'Get early access', href: '/early-access' },
			features: ['25 GB of storage']
		},
		{
			id: 'storage',
			name: 'Storage',
			price: '$6',
			unit: 'per TB a month',
			blurb: 'Pay for what you store.',
			cta: { label: 'Get early access', href: '/early-access' },
			features: ['No fees for API requests', 'No minimum storage duration'],
			featured: true
		}
	];

	it('gives each plan a heading, its price with the unit and a named check list', async () => {
		const a = await audit(PricingTable, { plans });
		expect(a.violations).toEqual([]);
		expect(all(a.document, 'h2').map(text)).toEqual(['Free', 'Storage']);
		expect(all(a.document, '.price').map(text)).toEqual(['$0 up to 25 GB', '$6 per TB a month']);
		expect(q(a.document, 'ul[aria-label="Included in Storage"]').children).toHaveLength(2);
	});

	it('gives only the featured plan the primary button', async () => {
		const a = await audit(PricingTable, { plans, headingLevel: 2 });
		expect(all(a.document, '.plan a').map((el) => el.className.includes('primary'))).toEqual([
			false,
			true
		]);
	});
});

describe('ComparisonTable', () => {
	it('is a captioned table in a focusable named region, with text for every icon', async () => {
		const a = await audit(ComparisonTable, {
			label: 'Plan comparison',
			columns: ['Free', 'Team'],
			rows: [
				{ label: 'Storage price', values: ['Included', '$9 per TB a month'] },
				{ label: 'Audit log', values: [false, true] }
			]
		});
		expect(a.violations).toEqual([]);
		const region = q(a.document, '[role="region"]');
		expect(region.getAttribute('aria-label')).toBe('Plan comparison');
		expect(region.getAttribute('tabindex')).toBe('0');
		expect(text(q(a.document, 'caption'))).toBe('Plan comparison');
		expect(all(a.document, 'tbody th[scope="row"]').map(text)).toEqual([
			'Storage price',
			'Audit log'
		]);
		expect(all(a.document, 'tbody tr:nth-child(2) td').map(text)).toEqual([
			'Not included',
			'Included'
		]);
	});
});

describe('FeatureGrid', () => {
	it('renders a list of headed items with decorative icons, in both variants', async () => {
		for (const variant of ['cards', 'list'] as const) {
			const a = await audit(FeatureGrid, {
				variant,
				headingLevel: 2,
				items: [
					{ icon: Check, title: 'Checked on upload', body: 'Every upload is verified.' },
					{ icon: Terminal, title: 'Works with S3 tools', body: 'Change the endpoint.' }
				]
			});
			expect(a.violations).toEqual([]);
			expect(all(a.document, 'li h2').map(text)).toEqual([
				'Checked on upload',
				'Works with S3 tools'
			]);
			expect(all(a.document, 'li svg').every((s) => s.getAttribute('aria-hidden') === 'true')).toBe(
				true
			);
		}
	});
});

describe('ToolBadges', () => {
	it('names every tool in text and shows notes such as "coming soon"', async () => {
		const a = await audit(ToolBadges, {
			headingId: 'works',
			tools: [
				{ name: 'rclone', icon: Terminal },
				{ name: 'WebDAV', icon: Terminal, note: 'coming soon' }
			]
		});
		expect(a.violations).toEqual([]);
		expect(q(a.document, 'h2').id).toBe('works');
		expect(all(a.document, 'li').map(text)).toEqual(['rclone', 'WebDAV(coming soon)']);
	});
});

describe('FAQ', () => {
	it('uses details and summary, closed by default', async () => {
		const a = await audit(FAQ, {
			items: [
				{ q: 'What is Kofra?', a: 'Cloud object storage.' },
				{ q: 'Is there a minimum?', a: 'No.' }
			]
		});
		expect(a.violations).toEqual([]);
		expect(all(a.document, 'details')).toHaveLength(2);
		expect(all(a.document, 'details[open]')).toHaveLength(0);
		expect(all(a.document, 'summary').map(text)).toEqual(['What is Kofra?', 'Is there a minimum?']);
	});
});

describe('CodeBlock', () => {
	it('escapes the code, captions it and needs no focus to read', async () => {
		const a = await audit(CodeBlock, { title: 'aws-cli', code: 'echo "<b>" && ls' });
		expect(a.violations).toEqual([]);
		expect(text(q(a.document, 'figcaption'))).toBe('aws-cli');
		expect(q(a.document, 'pre code').textContent).toBe('echo "<b>" && ls');
		expect(a.document.querySelector('b')).toBeNull();
		expect(q(a.document, 'pre').hasAttribute('tabindex')).toBe(false);
	});
});

describe('Callout', () => {
	it('is a note whose tone is in the words, not only the colour', async () => {
		const a = await audit(Callout, {
			tone: 'draft',
			title: 'Draft, not in force',
			children: html('<p>This text is a placeholder.</p>')
		});
		expect(a.violations).toEqual([]);
		const note = q(a.document, '[role="note"]');
		expect(text(note)).toBe('Draft, not in force This text is a placeholder.');
		expect(q(note, 'svg').getAttribute('aria-hidden')).toBe('true');
	});
});

describe('ThemeToggle', () => {
	it('is a toggle button with a stable name and a pressed state', async () => {
		const a = await audit(ThemeToggle, {});
		expect(a.violations).toEqual([]);
		const button = q(a.document, 'button');
		expect(button.getAttribute('type')).toBe('button');
		expect(button.getAttribute('aria-pressed')).toBe('false');
		expect(button.hasAttribute('data-theme-toggle')).toBe(true);
		expect(text(button)).toBe('Dark theme');
	});
});
