export const apiKeyTypeDefs=/* GraphQL */`
 type ApiKey { id: ID! orgId: ID! label: String! prefix: String! scopes: [String!]! createdAt: String! expiresAt: String! lastUsedAt: String revokedAt: String }
 type IssuedApiKey { id: ID! orgId: ID! label: String! prefix: String! scopes: [String!]! createdAt: String! expiresAt: String! token: String! }
 extend type Query { apiKeys(orgId:ID!): [ApiKey!]! }
 extend type Mutation { createApiKey(orgId:ID!,label:String!,scope:String!,expiresInDays:Int=90): IssuedApiKey! revokeApiKey(orgId:ID!,id:ID!): Boolean! }
`;
export { apiKeyQueries,apiKeyMutations } from '../controllers/api-key.controller.js';
