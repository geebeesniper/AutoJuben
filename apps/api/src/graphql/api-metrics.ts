export const apiMetricsTypeDefs=/* GraphQL */`
 type ApiMetricSummary { transport: String! total: Int! errors: Int! p95_ms: Float avg_ms: Float }
 extend type Query { apiMetrics(minutes: Int=60): [ApiMetricSummary!]! }
`;
export { apiMetricQueries } from '../controllers/api-metrics.controller.js';
