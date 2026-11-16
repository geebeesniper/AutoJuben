import { apiMetricSummary } from '../services/api-metrics.service.js';
import type { Context } from '../models/context.js';
export const apiMetricQueries={apiMetrics:(_r:unknown,{minutes}:{minutes:number},ctx:Context)=>apiMetricSummary(minutes,ctx)};
