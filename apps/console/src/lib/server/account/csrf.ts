const utf8 = new TextEncoder();

export function checkCsrf(expected: string, presented: FormDataEntryValue | null): boolean {
	// An empty or short expected value would match a forged empty field.
	if (typeof presented !== 'string' || expected.length < 16) return false;
	const a = utf8.encode(expected);
	const b = utf8.encode(presented);
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a[i]! ^ b[i]!;
	return mismatch === 0;
}
