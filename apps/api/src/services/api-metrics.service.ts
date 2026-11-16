import type { Context } from '../models/context.js';
import { requirePlatformAdmin } from '../billing/common.js';
import { platformMetricSummary,recordApiMetric } from '../repositories/api-metrics.repository.js';
import type { ApiMetric } from '../repositories/api-metrics.repository.js';
import { assert } from '../utils/errors.js';
export async function apiMetricSummary(minutes:number,ctx:Context){
 requirePlatformAdmin(ctx.user);
 assert(Number.isInteger(minutes)&&minutes>=5&&minutes<=10080,'窗口必须在 5–10080 分钟内');
 return platformMetricSummary(minutes);
}

export async function recordMetricSafely(metric:ApiMetric){
 try{await recordApiMetric(metric);}catch(e){console.warn('[API metric skipped]',e instanceof Error?e.message:'unknown');}
}
