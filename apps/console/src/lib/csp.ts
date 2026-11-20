/**
 * SHA-256 of the one inline style attribute the framework adds at runtime: the visually
 * hidden route announcer in @sveltejs/kit's root component. Allowing exactly this hash (with
 * 'unsafe-hashes' in style-src-attr) keeps every other inline style blocked. csp.spec.ts
 * recomputes it from the installed framework, so an upgrade that changes it fails the tests.
 */
export const ANNOUNCER_STYLE_HASH = 'sha256-S8qMpvofolR8Mpjy4kQvEm7m1q8clzU4dfDH0AmvZjo=';
