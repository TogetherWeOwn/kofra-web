import { sitemapXml, text } from '#lib/discovery.js';

export const prerender = true;
export const GET = () => text(sitemapXml(), 'application/xml');
