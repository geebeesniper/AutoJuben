/** Explicit mapping between PostgreSQL snake_case rows and API-facing camelCase DTOs. */
export const isoDate = (value: unknown): string | null =>
  value instanceof Date ? value.toISOString() : value ? new Date(value as string).toISOString() : null;

export function organizationView(o: any) {
  return {id:o.id,name:o.name,slug:o.slug,role:o.role,createdAt:isoDate(o.created_at)};
}
export function projectView(p: any) {
  return {id:p.id,orgId:p.org_id,name:p.name,description:p.description,jobCount:Number(p.job_count??0),createdAt:isoDate(p.created_at)};
}
export function videoJobView(j: any) {
  return {
    id:j.id,orgId:j.org_id,projectId:j.project_id,clientTaskId:j.client_task_id,providerTaskId:j.provider_task_id,
    model:j.model,duration:j.duration,ratio:j.ratio,resolution:j.resolution,prompt:j.prompt,status:j.status,progress:j.progress,
    requiredCredits:j.required_credits,billingStatus:j.billing_status,videoUrl:j.video_url?`/api/jobs/${j.id}/video`:null,
    errorCode:j.error_code,errorMessage:j.error_message,isDemo:j.provider_is_mock,
    platformCreditCost:j.platform_credit_cost??0,platformCreditState:j.platform_credit_state??'none',
    createdAt:isoDate(j.created_at),submittedAt:isoDate(j.submitted_at),finishedAt:isoDate(j.finished_at),updatedAt:isoDate(j.updated_at),
    imageUrls:j.image_urls??[],audioUrls:j.audio_urls??[],videoUrls:j.video_urls??[]
  };
}
export const billingProductView=(x:any)=>({id:x.id,sku:x.sku,name:x.name,description:x.description,
  credits:x.credits,amountCents:x.amount_cents,currency:x.currency,active:x.active});
export const adminOrderView=(x:any)=>({id:x.id,orgId:x.org_id,orgName:x.org_name,userId:x.user_id,userName:x.user_name,email:x.email,
  productName:x.product_name,credits:x.credits,amountCents:x.amount_cents,currency:x.currency,status:x.status,
  refundedAmountCents:x.refunded_amount_cents,refundedCredits:x.refunded_credits,stripeSessionId:x.stripe_session_id,
  createdAt:isoDate(x.created_at),paidAt:isoDate(x.paid_at)});
export const purchaseView=(x:any)=>({id:x.id,orgId:x.org_id,productName:x.product_name,credits:x.credits,
  amountCents:x.amount_cents,currency:x.currency,status:x.status,refundedAmountCents:x.refunded_amount_cents,
  createdAt:isoDate(x.created_at),paidAt:isoDate(x.paid_at)});
