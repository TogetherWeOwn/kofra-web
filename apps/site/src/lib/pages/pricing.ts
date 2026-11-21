// Copy for the pricing page. The page template and its Markdown twin both read from here.
import { PRICES_FINAL, SIGNUP_OPEN } from '#lib/site.js';

export const PRICING = {
	heading: 'Pricing',
	description: `Kofra pricing: pay per TB stored, with downloads up to 3× what you store and all API requests included.${PRICES_FINAL ? '' : SIGNUP_OPEN ? ' Example prices.' : ' Example prices for early access.'}`,
	lead: 'Pay per TB stored. Downloads up to 3× what you store and all API requests are included.',
	how: {
		heading: 'How billing works',
		lines: [
			'We record how much you store each day and bill the monthly average.',
			'Downloads count against an allowance of 3× your average storage.',
			'API requests are never charged.',
			'Invoices are issued on the 1st of each month. Cancel any time.'
		]
	},
	faqHeading: 'Pricing questions'
};
