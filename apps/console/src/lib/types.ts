/** What a page shows about a refused request: the API's own sentence and next step. */
export interface ShownProblem {
	message: string;
	hint?: string;
	requestId?: string;
	code?: string;
}
