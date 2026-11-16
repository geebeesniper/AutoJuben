import {test} from 'node:test';
import assert from 'node:assert/strict';
import {guardGraphqlDocument} from './graphql-guard.service.js';
const req=(query:unknown)=>new Request('https://example.org/graphql',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query})});
test('normal GraphQL operation accepted',async()=>assert.equal(await guardGraphqlDocument(req('query{me{id}}')),true));
test('GraphQL fragments and schema introspection rejected',async()=>{
 await assert.rejects(()=>guardGraphqlDocument(req('query{__schema{types{name}}}')),/introspection/);
 await assert.rejects(()=>guardGraphqlDocument(req('query{me{...Fields}} fragment Fields on User{id}')),/fragment/);
});
test('GraphQL nesting constrained',async()=>{
 const q='query{'+('a{'.repeat(11))+'b'+('}'.repeat(11))+'}';
 await assert.rejects(()=>guardGraphqlDocument(req(q)),/嵌套/);
});
