// Writes tokens.css from tokens.json. The unit tests fail when the committed
// tokens.css differs from this output, so run this after every token change.
import { readFileSync, writeFileSync } from 'node:fs';
import { toCss, type Json } from '../src/css.ts';

const root = new URL('../', import.meta.url);
const tree = JSON.parse(readFileSync(new URL('tokens.json', root), 'utf8')) as Json;
writeFileSync(new URL('tokens.css', root), toCss(tree));
