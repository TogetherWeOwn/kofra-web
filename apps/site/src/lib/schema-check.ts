// A strict checker for the schema.org JSON-LD this site emits. Each type lists the properties
// schema.org defines for it (only the ones we may use) and which of them we require. Unknown
// types, unknown properties and missing required properties are errors, so a typo cannot ship.
// Every type and property here was checked against the schema.org vocabulary file
// (schemaorg-current-https.jsonld, including inherited domains) on 2026-11-19.

type Spec = { required: string[]; allowed: string[] };

const THING = ['name', 'url', 'description', '@id'];

export const TYPES: Record<string, Spec> = {
	Organization: {
		required: ['name', 'url'],
		allowed: [...THING, 'logo', 'legalName', 'email', 'address', 'sameAs']
	},
	WebSite: { required: ['name', 'url'], allowed: [...THING, 'inLanguage', 'publisher'] },
	BreadcrumbList: { required: ['itemListElement'], allowed: [...THING, 'itemListElement'] },
	ListItem: { required: ['position', 'name', 'item'], allowed: [...THING, 'position', 'item'] },
	FAQPage: { required: ['mainEntity'], allowed: [...THING, 'mainEntity'] },
	Question: { required: ['name', 'acceptedAnswer'], allowed: [...THING, 'acceptedAnswer'] },
	Answer: { required: ['text'], allowed: [...THING, 'text'] },
	Product: {
		required: ['name', 'offers'],
		allowed: [...THING, 'brand', 'offers', 'image']
	},
	Offer: {
		required: ['price', 'priceCurrency'],
		allowed: [...THING, 'price', 'priceCurrency', 'priceSpecification', 'availability']
	},
	UnitPriceSpecification: {
		required: ['price', 'priceCurrency'],
		allowed: [...THING, 'price', 'priceCurrency', 'unitText', 'unitCode', 'referenceQuantity']
	},
	TechArticle: {
		required: ['headline', 'url'],
		allowed: [
			...THING,
			'headline',
			'dateModified',
			'datePublished',
			'inLanguage',
			'author',
			'publisher',
			'isPartOf'
		]
	}
};

/** Returns a list of problems; empty means valid. */
export function checkJsonLd(doc: unknown): string[] {
	const problems: string[] = [];
	const ids = new Set<string>();
	const refs: [string, string][] = [];

	const visit = (node: unknown, where: string) => {
		if (Array.isArray(node)) return node.forEach((n, i) => visit(n, `${where}[${i}]`));
		if (typeof node !== 'object' || node === null) return;
		const obj = node as Record<string, unknown>;
		const keys = Object.keys(obj);
		// A bare {"@id": ...} is a reference to a node defined elsewhere in the graph.
		if (keys.length === 1 && keys[0] === '@id') {
			refs.push([String(obj['@id']), where]);
			return;
		}
		const type = obj['@type'];
		if (typeof type !== 'string') {
			problems.push(`${where}: missing @type`);
			return;
		}
		const spec = TYPES[type];
		if (!spec) {
			problems.push(`${where}: unknown or unsupported type ${type}`);
			return;
		}
		if (typeof obj['@id'] === 'string') ids.add(obj['@id']);
		for (const k of keys) {
			if (k === '@type' || k === '@context') continue;
			if (!spec.allowed.includes(k)) problems.push(`${where}: ${type} has no property ${k}`);
		}
		for (const r of spec.required) {
			const v = obj[r];
			if (v === undefined || v === '' || (Array.isArray(v) && v.length === 0)) {
				problems.push(`${where}: ${type} needs ${r}`);
			}
		}
		for (const k of keys) if (!k.startsWith('@')) visit(obj[k], `${where}.${k}`);
	};

	if (typeof doc !== 'object' || doc === null) return ['not an object'];
	const root = doc as Record<string, unknown>;
	if (root['@context'] !== 'https://schema.org')
		problems.push('@context must be https://schema.org');
	const graph = root['@graph'];
	if (!Array.isArray(graph) || graph.length === 0)
		problems.push('@graph must be a non-empty array');
	else visit(graph, '@graph');
	for (const [id, where] of refs) {
		if (!ids.has(id)) problems.push(`${where}: reference to undefined node ${id}`);
	}
	// Placeholders must never reach structured data.
	if (/\[[A-Z][A-Z ]+\]/.test(JSON.stringify(doc)))
		problems.push('contains a [PLACEHOLDER] marker');
	return problems;
}
