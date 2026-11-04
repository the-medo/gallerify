import { createAuthClient } from 'better-auth/react';

// Same-origin HTTP-only cookies; no credentials or session tokens in localStorage.
export const authClient = createAuthClient();
