import { llmsTxt, text } from '#lib/discovery.js';

export const prerender = true;
export const GET = () => text(llmsTxt(), 'text/plain');
