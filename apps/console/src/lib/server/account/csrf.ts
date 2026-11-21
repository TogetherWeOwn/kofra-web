const utf8 = new TextEncoder();

export function checkCsrf(expected: string, presented: FormDataEntryValue | null): boolean {
	if (typeof presented !== 'string') return false;
	const a = utf8.encode(expected);
	const b = utf8.encode(presented);
	if (a.length !== b.length) return false;
	let mismatch = 0;
	for (let i = 0; i < a.length; i++) mismatch |= a[i]! ^ b[i]!;
	return mismatch === 0;
}
