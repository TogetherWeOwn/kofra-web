// Legal page drafts. NOT IN FORCE. Facts only the owner can supply are bracketed markers such as
// [COMPANY LEGAL NAME]; nothing here invents a company fact. Replace every marker and have the text
// reviewed before Kofra accepts customers.
import type { Block } from '#lib/blocks.js';

export const DRAFT_TITLE = 'Draft, not in force.';
export const DRAFT_NOTICE =
	'This is a draft for review. It is not in force, it is not an offer and it does not form an agreement. Kofra is not accepting customers yet. Bracketed items such as [COMPANY LEGAL NAME] are placeholders.';

export const TERMS = {
	heading: 'Terms of service (draft)',
	description: 'Draft terms of service for Kofra cloud storage. Not in force.',
	lead: 'The agreement that will apply when you use Kofra.',
	notice: { tone: 'draft', title: DRAFT_TITLE, text: DRAFT_NOTICE } as const
};

export const TERMS_BLOCKS: Block[] = [
	{ type: 'h2', text: '1. Who we are' },
	{
		type: 'p',
		text: 'Kofra is provided by [COMPANY LEGAL NAME], registered in [JURISDICTION] under number [COMPANY NUMBER], with its registered office at [REGISTERED ADDRESS] (“Kofra”, “we”). You can contact us at [CONTACT EMAIL].'
	},
	{ type: 'h2', text: '2. The service' },
	{
		type: 'p',
		text: 'Kofra provides cloud object storage that you reach through an S3-compatible API and related tools. The features, limits and prices of each plan are described on the [pricing page](/pricing) and in the [documentation](/docs).'
	},
	{ type: 'h2', text: '3. Your account' },
	{
		type: 'ul',
		items: [
			'You must give accurate account details and keep your password and access keys secret.',
			'You are responsible for activity under your account and keys.',
			'Minimum age and eligibility: [ELIGIBILITY REQUIREMENTS].'
		]
	},
	{ type: 'h2', text: '4. Your data' },
	{
		type: 'p',
		text: 'You keep all rights in the data you store. You give Kofra only the permission needed to store, copy, transmit and delete it to provide the service to you.'
	},
	{ type: 'h2', text: '5. Acceptable use' },
	{
		type: 'p',
		text: 'You must not use Kofra to store or share unlawful content, to infringe others’ rights, or to attack or overload the service. Details: [ACCEPTABLE USE POLICY].'
	},
	{ type: 'h2', text: '6. Fees and billing' },
	{
		type: 'p',
		text: 'Paid plans are billed monthly in [CURRENCY] as described on the pricing page. Taxes: [TAX TERMS]. Late payment: [NON-PAYMENT TERMS].'
	},
	{ type: 'h2', text: '7. Ending the service' },
	{
		type: 'p',
		text: 'You can close your account at any time. What happens to stored data after closing, and for how long it can be recovered: [DATA RETENTION AFTER CLOSURE].'
	},
	{ type: 'h2', text: '8. Warranties and liability' },
	{ type: 'p', text: '[WARRANTY DISCLAIMER AND LIMITATION OF LIABILITY].' },
	{ type: 'h2', text: '9. Changes to these terms' },
	{
		type: 'p',
		text: 'How we tell you about changes, and when they take effect: [CHANGE NOTICE TERMS].'
	},
	{ type: 'h2', text: '10. Governing law' },
	{
		type: 'p',
		text: 'These terms are governed by the laws of [GOVERNING LAW]. Courts: [JURISDICTION OF COURTS].'
	},
	{ type: 'p', text: 'Effective date: [EFFECTIVE DATE].' }
];

export const PRIVACY = {
	heading: 'Privacy policy (draft)',
	description: 'Draft privacy policy for Kofra cloud storage. Not in force.',
	lead: 'What personal data Kofra will process, why, and your rights.',
	notice: { tone: 'draft', title: DRAFT_TITLE, text: DRAFT_NOTICE } as const
};

export const PRIVACY_BLOCKS: Block[] = [
	{ type: 'h2', text: '1. Who is responsible' },
	{
		type: 'p',
		text: 'The controller of your personal data is [COMPANY LEGAL NAME], [REGISTERED ADDRESS]. Contact for privacy questions: [PRIVACY CONTACT EMAIL]. Data protection officer or representative, where required: [DPO OR REPRESENTATIVE].'
	},
	{ type: 'h2', text: '2. This website' },
	{
		type: 'ul',
		items: [
			'This website sets no cookies and loads no third-party scripts, fonts or analytics.',
			'If you use the theme switch, your choice (light or dark) is kept in your browser’s local storage and never sent to us.',
			'Our hosting provider processes your IP address and request details to deliver pages and protect the service: [HOSTING PROVIDER AND LOG RETENTION].'
		]
	},
	{ type: 'h2', text: '3. Early access list' },
	{
		type: 'p',
		text: 'The early access list is not open. Before it opens, this section will state what is collected (an email address), the legal basis (your consent, confirmed by email), how long it is kept, and how to remove it: [EARLY ACCESS LIST DETAILS].'
	},
	{ type: 'h2', text: '4. Customers' },
	{
		type: 'p',
		text: 'When accounts open: account and billing details, usage records for billing, and security logs. Purposes, legal bases and retention periods: [CUSTOMER DATA DETAILS]. Kofra does not access the contents of your stored files except to provide the service or where the law requires: [CONTENT ACCESS TERMS].'
	},
	{ type: 'h2', text: '5. Service providers' },
	{
		type: 'p',
		text: 'Processors that handle personal data for us, and where: [LIST OF PROCESSORS AND LOCATIONS].'
	},
	{ type: 'h2', text: '6. International transfers' },
	{ type: 'p', text: '[TRANSFER MECHANISMS].' },
	{ type: 'h2', text: '7. Your rights' },
	{
		type: 'p',
		text: 'Depending on where you live, you may have rights to access, correct, delete or export your personal data, and to object or complain to a supervisory authority: [RIGHTS AND HOW TO EXERCISE THEM].'
	},
	{ type: 'h2', text: '8. Changes' },
	{
		type: 'p',
		text: 'Effective date: [EFFECTIVE DATE]. How we tell you about changes: [CHANGE NOTICE].'
	}
];
