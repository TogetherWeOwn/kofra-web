// schema.org structured data (JSON-LD) for each page, built from the registry and content.
import { FAQ_DATA, FAQ_GENERAL, FAQ_PRICING, PLANS } from '#lib/content.js';
import { canonical, pageFor, type PageEntry } from '#lib/registry.js';
import { ORGANISATION_FACTS, PRICES_FINAL, SITE } from '#lib/site.js';

type Node = Record<string, unknown>;

const ORG_ID = `${SITE.origin}/#organization`;
const SITE_ID = `${SITE.origin}/#website`;

export function organization(): Node {
	const f = ORGANISATION_FACTS;
	return {
		'@type': 'Organization',
		'@id': ORG_ID,
		name: SITE.name,
		url: `${SITE.origin}/`,
		logo: `${SITE.origin}${SITE.logo}`,
		// Legal facts are added only once the owner supplies them (see site.ts).
		...(f.legalName ? { legalName: f.legalName } : {}),
		...(f.email ? { email: f.email } : {}),
		...(f.address ? { address: f.address } : {})
	};
}

export function website(): Node {
	return {
		'@type': 'WebSite',
		'@id': SITE_ID,
		name: SITE.name,
		url: `${SITE.origin}/`,
		inLanguage: 'en',
		publisher: { '@id': ORG_ID }
	};
}

export function breadcrumbs(entry: PageEntry): Node {
	const trail: PageEntry[] = [];
	for (let e: PageEntry | undefined = entry; e; e = e.parent ? pageFor(e.parent) : undefined) {
		trail.unshift(e);
	}
	const items = [
		{ name: 'Home', path: '/' },
		...trail.map((e) => ({ name: e.name, path: e.path }))
	];
	return {
		'@type': 'BreadcrumbList',
		itemListElement: items.map((it, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: it.name,
			item: canonical(it.path)
		}))
	};
}

export function faqPage(entry: PageEntry): Node {
	return {
		'@type': 'FAQPage',
		url: canonical(entry.path),
		mainEntity: [...FAQ_GENERAL, ...FAQ_PRICING, ...FAQ_DATA].map((f) => ({
			'@type': 'Question',
			name: f.q,
			acceptedAnswer: { '@type': 'Answer', text: f.a }
		}))
	};
}

/** Product and offers. Emitted only once PRICES_FINAL is true (see site.ts). */
export function product(entry: PageEntry): Node {
	return {
		'@type': 'Product',
		name: 'Kofra Object Storage',
		description: entry.description,
		url: canonical(entry.path),
		brand: { '@id': ORG_ID },
		offers: PLANS.map((p) => {
			const price = p.price.replace(/[^0-9.]/g, '');
			return {
				'@type': 'Offer',
				name: p.name,
				price,
				priceCurrency: 'USD',
				url: canonical(entry.path),
				...(p.id === 'free'
					? {}
					: {
							priceSpecification: {
								'@type': 'UnitPriceSpecification',
								price,
								priceCurrency: 'USD',
								unitText: 'TB per month'
							}
						})
			};
		})
	};
}

export function techArticle(entry: PageEntry): Node {
	return {
		'@type': 'TechArticle',
		headline: entry.name,
		description: entry.description,
		url: canonical(entry.path),
		dateModified: entry.updated,
		inLanguage: 'en',
		author: { '@id': ORG_ID },
		publisher: { '@id': ORG_ID },
		isPartOf: { '@id': SITE_ID }
	};
}

/** The JSON-LD graph for one page. */
export function graphFor(entry: PageEntry): Node {
	const nodes: Node[] = [organization(), website()];
	if (entry.kind !== 'home') nodes.push(breadcrumbs(entry));
	if (entry.path === '/faq') nodes.push(faqPage(entry));
	if (entry.path === '/pricing' && PRICES_FINAL) nodes.push(product(entry));
	if (entry.kind === 'docs') nodes.push(techArticle(entry));
	return { '@context': 'https://schema.org', '@graph': nodes };
}

/** Serialises JSON-LD for a <script> element: "<" is escaped so no text can close the element. */
export const serialise = (graph: Node) => JSON.stringify(graph).replace(/</g, '\\u003c');
