/** Pure billing math; integer cents + integer credits, never floating currency amounts. */
export function refundCreditTotal(credits:number,amountCents:number,refundedCents:number):number {
 if(!Number.isSafeInteger(credits)||credits<=0||!Number.isSafeInteger(amountCents)||amountCents<=0||!Number.isSafeInteger(refundedCents))
  throw new Error('Invalid credit/refund values');
 const amount=Math.max(0,Math.min(amountCents,refundedCents));
 // Avoid integer precision loss from multiplying two large numbers.
 return Number((BigInt(credits)*BigInt(amount))/BigInt(amountCents));
}
export function canReserveCredits(balance:number,cost:number):boolean {
 return Number.isSafeInteger(balance)&&Number.isSafeInteger(cost)&&cost>0&&balance>=cost;
}
