/**
 * Utility functions for tracking analytics metrics
 */

type MetricType = "currency" | "number" | "percentage";

interface MetricData {
  id: string;
  value: number;
  label: string;
  type: MetricType;
  timestamp?: string;
}

/**
 * Tracks a metric for analytics purposes
 * This is a simple implementation that just logs the metric data
 * In a real application, this would send the data to an analytics service
 */
export function trackMetric(data: MetricData): void {
  const { id, value, label, type } = data;
  console.log(`[Analytics] Tracking ${type} metric: ${label} (${id}) = ${value}`);
  
  // Example implementation for future integration with analytics service:
  // analytics.trackMetric({
  //   ...data,
  //   timestamp: data.timestamp || new Date().toISOString()
  // });
}

export default {
  trackMetric
}; 