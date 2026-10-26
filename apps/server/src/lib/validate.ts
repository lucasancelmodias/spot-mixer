import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { z } from 'zod';

/** Parses the JSON body with the schema. Input that is not valid ends the request with 400. */
export async function parseJson<T>(c: Context, schema: z.ZodType<T>): Promise<T> {
	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		throw badRequest('invalid_json', []);
	}
	const result = schema.safeParse(body);
	if (!result.success) {
		throw badRequest(
			'invalid_request',
			result.error.issues.map((issue) => `${issue.path.join('.') || '(body)'}: ${issue.message}`)
		);
	}
	return result.data;
}

/** A 400 response with an error code and the problems found. */
export function badRequest(error: string, issues: string[]): HTTPException {
	return new HTTPException(400, { res: Response.json({ error, issues }, { status: 400 }) });
}
