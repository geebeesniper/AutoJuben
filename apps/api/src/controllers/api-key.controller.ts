import { apiKeyService } from '../services/api-key.service.js';
import type { Context } from '../models/context.js';
/** API controllers share the identical service for GraphQL, REST and JSON commands. */
export const apiKeyQueries={ apiKeys:(_r:unknown,{orgId}:{orgId:string},ctx:Context)=>apiKeyService.list(orgId,ctx) };
export const apiKeyMutations={
  createApiKey:(_r:unknown,{orgId,label,scope,expiresInDays}:{orgId:string;label:string;scope:string;expiresInDays:number},ctx:Context)=>
    apiKeyService.create(orgId,label,scope,expiresInDays,ctx),
  revokeApiKey:(_r:unknown,{orgId,id}:{orgId:string;id:string},ctx:Context)=>apiKeyService.revoke(orgId,id,ctx)
};
