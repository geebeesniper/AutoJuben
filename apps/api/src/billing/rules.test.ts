import { test } from 'node:test';
import assert from 'node:assert/strict';
import { refundCreditTotal,canReserveCredits } from './rules.js';

test('No refund means zero credits revoked',()=>assert.equal(refundCreditTotal(100,1000,0),0));
test('Partial refund revokes proportional whole credits',()=>assert.equal(refundCreditTotal(100,1000,333),33));
test('Full refund revokes all credits',()=>assert.equal(refundCreditTotal(100,1000,1000),100));
test('Over-refund is capped',()=>assert.equal(refundCreditTotal(100,1000,1200),100));
test('Integer math works for large values',()=>assert.equal(refundCreditTotal(1000000,100000000,99000000),990000));
test('Reserve only when balance covers all credits',()=>{assert.equal(canReserveCredits(9,10),false);assert.equal(canReserveCredits(10,10),true);assert.equal(canReserveCredits(-1,1),false);});
