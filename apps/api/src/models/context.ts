import type { User } from '../auth/sessions.js';
/** Per-request identity, never cached across serverless invocations. */
export type Context = { user: User | null };
