import { tick } from 'svelte';

/**
 * After a refused submission, moves focus to the first field marked invalid, so keyboard
 * and screen-reader users land on the error (its text is tied to the field). A refusal not
 * tied to a field shows in a notice that announces itself (role="alert").
 */
export async function focusFirstInvalid(root: ParentNode = document) {
	await tick();
	root.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
}
