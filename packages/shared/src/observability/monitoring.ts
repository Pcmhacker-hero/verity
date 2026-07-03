import { logger } from './logger.js';
import { metrics } from './metrics.js';

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface Alert {
  name: string;
  message: string;
  severity: AlertSeverity;
  subsystem: string;
  value?: number | string;
  threshold?: number | string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface HealthCheckResult {
  name: string;
  status: HealthStatus;
  message?: string;
  latencyMs?: number;
  metadata?: Record<string, unknown>;
}

export interface HealthCheck {
  name: string;
  subsystem: string;
  check: () => Promise<HealthCheckResult>;
}

export interface MonitoringProvider {
  onAlert(alert: Alert): void;
}

class StructuredLogMonitoringProvider implements MonitoringProvider {
  onAlert(alert: Alert): void {
    const level = alert.severity === 'critical' ? 'error' : alert.severity === 'warning' ? 'warn' : 'info';
    logger[level]('monitoring_alert', { alert });
  }
}

const providers: MonitoringProvider[] = [new StructuredLogMonitoringProvider()];

export function registerMonitoringProvider(provider: MonitoringProvider): void {
  providers.push(provider);
}

class MonitoringRegistryImpl {
  private checks: HealthCheck[] = [];

  registerCheck(check: HealthCheck): void {
    this.checks.push(check);
  }

  emitAlert(
    name: string,
    message: string,
    severity: AlertSeverity,
    subsystem: string,
    value?: number | string,
    threshold?: number | string,
    metadata?: Record<string, unknown>
  ): void {
    const alert: Alert = {
      name,
      message,
      severity,
      subsystem,
      value,
      threshold,
      metadata,
      timestamp: new Date().toISOString(),
    };
    
    // Auto-record metric for the alert
    metrics.increment('monitoring_alerts_total', 1, { name, severity, subsystem });

    providers.forEach(p => p.onAlert(alert));
  }

  async getSystemHealth(): Promise<{ status: HealthStatus; results: HealthCheckResult[] }> {
    const results = await Promise.all(
      this.checks.map(async (c) => {
        try {
          const start = Date.now();
          const res = await c.check();
          if (!res.latencyMs) res.latencyMs = Date.now() - start;
          return res;
        } catch (error) {
          return {
            name: c.name,
            status: 'unhealthy',
            message: error instanceof Error ? error.message : String(error),
          } as HealthCheckResult;
        }
      })
    );

    let systemStatus: HealthStatus = 'healthy';
    for (const r of results) {
      if (r.status === 'unhealthy') {
        systemStatus = 'unhealthy';
        break; // Unhealthy overrides everything
      }
      if (r.status === 'degraded') {
        systemStatus = 'degraded';
      }
    }

    return {
      status: systemStatus,
      results,
    };
  }
}

export const monitorRegistry = new MonitoringRegistryImpl();
