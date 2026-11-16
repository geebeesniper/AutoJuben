/** Stable transport-independent structures and authorization scopes. */
import type { User } from '../auth/sessions.js';
export type ApiScope = 'read'|'write';
export type ApiAuthMode = 'session'|'api_key';
export type ApiPrincipal = { user: User; mode: ApiAuthMode; orgId?: string; scopes?: ApiScope[]; keyId?: string };
export type ApiEnvelope<T> = {ok:true;data:T;meta:{requestId:string;version:'v1'}};
export type ApiFailure = {ok:false;error:{code:string;message:string};meta:{requestId:string;version:'v1'}};
