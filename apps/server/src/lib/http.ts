export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

// Wrap the global fetch so it can be passed as a dependency and replaced in tests.
export const globalFetch: FetchLike = (input, init) => fetch(input, init);
