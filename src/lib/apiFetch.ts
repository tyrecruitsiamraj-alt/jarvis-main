/**
 * Same-origin API calls (Vite proxy in dev). Sends cookies for auth.
 */
export function apiFetch(input: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body && typeof init.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, {
    ...init,
    credentials: 'include',
    headers,
  });
}
