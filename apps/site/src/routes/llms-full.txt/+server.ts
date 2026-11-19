import { llmsFullTxt, text } from '#lib/discovery.js';

export const prerender = true;
export const GET = () => text(llmsFullTxt(), 'text/plain');
