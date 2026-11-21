import { json, type RequestHandler } from '@sveltejs/kit';
import { account, refused } from './actions.js';
import { AccountProblem } from './client.js';
import { nextPath, setSession } from './session.js';
import type { PasskeyAssertion } from './types.js';

type Flow = 'register' | 'public-login' | 'second-step' | 'reauth';

export function passkeyPost(flow: Flow, finish = false): RequestHandler {
	return async (event) => {
		const me = event.locals.me;
		const client = account(event);
		const next = nextPath(event.url.searchParams.get('next'));
		const login = flow === 'public-login' || flow === 'second-step';
		try {
			if (!/^application\/json(?:\s*;|$)/i.test(event.request.headers.get('content-type') ?? ''))
				throw new AccountProblem(400, 'invalid_request', '');
			if (
				flow === 'public-login'
					? !!me
					: me?.session.stage !== (flow === 'second-step' ? 'second_step' : 'full')
			)
				throw new AccountProblem(401, 'session_invalid', '');
			if (!finish) {
				return json(
					await (login
						? client.passkeyLoginBegin()
						: flow === 'register'
							? client.passkeyRegisterBegin()
							: client.passkeyReauthBegin())
				);
			}
			const body = (await event.request.json().catch(() => null)) as {
				challenge_id?: unknown;
				credential?: PasskeyAssertion['credential'];
				name?: unknown;
				password?: unknown;
			} | null;
			const name = typeof body?.name === 'string' ? body.name.trim() : '';
			if (
				typeof body?.challenge_id !== 'string' ||
				!body.credential ||
				typeof body.credential !== 'object' ||
				Array.isArray(body.credential) ||
				(flow === 'register' && !name)
			)
				throw new AccountProblem(400, 'invalid_request', '');
			const assertion: PasskeyAssertion = {
				challenge_id: body.challenge_id,
				credential: body.credential
			};
			if (flow === 'register') {
				const password = typeof body?.password === 'string' ? body.password : '';
				return json(
					await client.passkeyRegisterFinish(
						password ? { ...assertion, name, password } : { ...assertion, name }
					),
					{ status: 201 }
				);
			}
			if (login) {
				const answer = await client.passkeyLoginFinish(assertion);
				setSession(event.cookies, answer.session);
			} else {
				await client.passkeyReauthFinish(assertion);
			}
			return json({ next });
		} catch (err) {
			if (err instanceof AccountProblem && err.code === 'step_required') {
				return json({ redirect: '/confirm-identity?next=%2Faccount' }, { status: 403 });
			}
			const problem = refused(err, event.url.pathname, {});
			return json(problem.data.problem, {
				status: problem.status,
				headers:
					err instanceof AccountProblem && err.retryAfter
						? { 'Retry-After': err.retryAfter }
						: undefined
			});
		}
	};
}
