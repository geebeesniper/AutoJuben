/** Offline source-contract checks; no npm dependencies or credentials required. */
import assert from 'node:assert/strict';
import { readFileSync,existsSync } from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const groups={
 core:{queries:['me','organizations','projects','members','dashboard','jobs','job','providerInfo','auditLogs'],mutations:['createOrganization','createProject','updateProject','deleteProject','addMember','changeMemberRole','removeMember','saveProviderKey','createVideoJob','resolveSubmission']},
 portal:{queries:['viewerCapabilities','myHistory','myOrders','billingCatalog','myPaymentCards','walletSummary','billingAvailability'],mutations:['updateMyName','createCheckout','createBillingPortal']},
 admin:{queries:['adminSearchUsers','adminOrders','adminProducts','adminTariffs','adminBillingSettings','adminApiSettings','adminTestStripe','adminTestVideoApi'],mutations:['adminSetUserDisabled','adminSaveProduct','adminSaveTariff','adminDeleteTariff','adminSetBillingFlags','adminSaveStripeIntegration','adminSaveGlobalVideoKey']},
 launcher:{queries:['launcherContainerLogs','launcherStatus','launcherCheckUpdates','launcherReleases','launcherBackups','launcherEvents','launcherActivationCodes'],mutations:['launcherAllAction','launcherServiceAction','launcherSavePreferences','launcherProvisionContainers','launcherPublishRelease','launcherInstallRelease','launcherConfirmDeployment','launcherCreateBackup','launcherRestoreBackup','launcherIssueActivation','launcherRevokeActivation','launcherRedeemActivation']}
};
let pass=0;
for(const [module,contract] of Object.entries(groups)){
  const schema=read(`apps/api/src/graphql/${module==='core'?'schema':module}.ts`);
  const ctl=read(`apps/api/src/controllers/${module}.controller.ts`);
  const svc=read(`apps/api/src/services/${module}.service.ts`);
  for(const [operation,fields] of Object.entries(contract)){
    for(const name of fields){
      assert.match(schema,new RegExp(`\\b${name}\\s*\\(`).test(schema)?new RegExp(`\\b${name}\\s*\\(`):new RegExp(`\\b${name}\\s*:`),`${module} missing GraphQL field: ${name}`);
      assert.match(ctl,new RegExp(`\\b${name}:`),`${module} missing controller: ${name}`);
      if(module==='core'&&['createVideoJob','resolveSubmission'].includes(name))
        assert.match(read('apps/api/src/services/video-job.service.ts'),new RegExp(`\\b${name}:`));
      else assert.match(svc,new RegExp(`\\b${name}:`),`${module} missing service: ${name}`);
      pass++;
    }
  }
  assert(!/\b(?:SELECT|INSERT|UPDATE|DELETE)\b\s+\b(?:FROM|INTO|[a-z])/i.test(ctl),`SQL found in ${module} controller`);
}
const vercel=JSON.parse(read('vercel.json'));
assert.equal(vercel.outputDirectory,'apps/web/dist');
assert(vercel.rewrites.some(r=>r.source==='/graphql'));
assert(vercel.rewrites.some(r=>r.source==='/auth/:action'));
for(const required of ['api/handler.ts','api/cron.ts','api/stripe.ts'])
 assert(existsSync(new URL('../'+required,import.meta.url)),`missing Vercel entry: ${required}`);
assert.match(read('apps/api/src/services/video-job.service.ts'),/client_task_id/);
assert.match(read('apps/api/src/billing/stripe.ts'),/stripe\.webhooks\.constructEvent/);
assert.match(read('apps/api/src/repositories/auth.repository.ts'),/auth_throttle/);
assert.match(read('apps/api/src/repositories/storage.repository.ts'),/uploaded_assets/);
console.log(`PASS ${pass} GraphQL operations mapped through schema, controller and service; Vercel/API/Stripe/auth/storage contracts retained.`);
