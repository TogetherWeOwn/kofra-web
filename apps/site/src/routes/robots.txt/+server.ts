import { robotsTxt, text } from '#lib/discovery.js';
import { INDEXABLE } from '#lib/site.js';

export const prerender = true;
export const GET = () => text(robotsTxt(INDEXABLE), 'text/plain');
