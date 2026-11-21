// Test helper: wraps a transport so every request and response is checked against the
// contract (vendor/openapi.json). For tests only; it pulls in a JSON Schema validator.
import { Ajv2020 } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';
import spec from '../../vendor/openapi.json';

const addFormats = addFormatsModule as unknown as (ajv: Ajv2020) => void;
const SPEC_ID = 'https://api.kofra.app/openapi.json';
const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: true });
addFormats(ajv);
ajv.addSchema({ ...spec, $id: SPEC_ID });

interface Op {
	method: string;
	template: string;
	re: RegExp;
	id: string;
	node: Record<string, unknown>;
}
const OPS: Op[] = Object.entries(
	spec.paths as unknown as Record<string, Record<string, Record<string, unknown>>>
).flatMap(([template, item]) =>
	Object.entries(item)
		.filter(([m]) => ['get', 'post', 'patch', 'delete', 'put'].includes(m))
		.map(([m, node]) => ({
			method: m.toUpperCase(),
			template,
			re: new RegExp(`^${template.replace(/\{[^}]+\}/g, '[^/]+')}$`),
			id: node.operationId as string,
			node
		}))
);

const ptr = (s: string) => s.replace(/~/g, '~0').replace(/\//g, '~1');
const validator = (pointer: string) =>
	ajv.getSchema(`${SPEC_ID}#${pointer}`) ?? ajv.compile({ $ref: `${SPEC_ID}#${pointer}` });

/**
 * A fetch that passes each request to `inner` and records every way the exchange departs
 * from the contract in `problems`. Requests the transport refused are not checked (tests
 * send invalid ones on purpose); every response is.
 */
export function contractChecked(inner: (req: Request) => Promise<Response>) {
	const problems: string[] = [];
	const covered = new Set<string>();
	const checkedFetch: typeof fetch = async (input, init) => {
		const req = new Request(input, init);
		const url = new URL(req.url);
		const op = OPS.find((o) => o.method === req.method && o.re.test(url.pathname));
		const reqBody =
			req.method === 'GET' || req.method === 'DELETE' ? undefined : await req.clone().text();
		const res = await inner(req);
		if (!op) {
			problems.push(`no operation for ${req.method} ${url.pathname}`);
			return res;
		}
		covered.add(op.id);
		const base = `/paths/${ptr(op.template)}/${op.method.toLowerCase()}`;
		if (reqBody && res.ok) {
			const v = validator(`${base}/requestBody/content/application~1json/schema`);
			if (!v(JSON.parse(reqBody))) problems.push(`${op.id} request: ${ajv.errorsText(v.errors)}`);
		}
		const status = String(res.status);
		const responses = op.node.responses as Record<string, { content?: Record<string, unknown> }>;
		if (!responses[status]) problems.push(`${op.id}: undeclared status ${status}`);
		const text = await res.clone().text();
		const type = res.headers.get('content-type') ?? '';
		const declared = responses[status]?.content ?? {};
		if (Object.keys(declared).length === 0) {
			if (text) problems.push(`${op.id} ${status}: body on a response declared without one`);
		} else if (!text) {
			problems.push(`${op.id} ${status}: empty body on a response declared with one`);
		} else {
			const media = type.split(';')[0]!.trim();
			if (!(media in declared)) problems.push(`${op.id} ${status}: undeclared ${type}`);
			else {
				const v = validator(`${base}/responses/${status}/content/${ptr(media)}/schema`);
				if (!v(JSON.parse(text))) problems.push(`${op.id} ${status}: ${ajv.errorsText(v.errors)}`);
			}
		}
		return res;
	};
	return { fetch: checkedFetch, problems, covered };
}
