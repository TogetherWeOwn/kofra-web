// Pages the waitlist form and confirmation redirect to. Static and noindex; outside the registry.
export const RESULTS = {
	sent: {
		heading: 'Check your email',
		lead: 'If the address is valid, we have sent it a confirmation link. The link expires in 24 hours. Nothing there? Check your spam folder, or try again in an hour.'
	},
	'try-again': {
		heading: 'Please try again',
		lead: 'We could not add that address. Check it and try again, or wait a minute if you sent several requests.'
	},
	confirmed: {
		heading: 'You are on the list',
		lead: 'Thank you. We will email you when Kofra opens for sign-ups. The privacy policy explains how to be removed.'
	},
	'link-expired': {
		heading: 'This link has expired',
		lead: 'Confirmation links work once and expire after 24 hours. Join the list again to get a new one.'
	}
} as const;

export type WaitlistResult = keyof typeof RESULTS;
