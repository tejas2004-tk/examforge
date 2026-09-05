import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

// Enable metrics collection
client.collectDefaultMetrics();

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP request count',
  labelNames: ['method', 'route', 'status'],
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.route?.path ?? req.path;
  const start = process.hrtime();
  res.on('finish', () => {
    const duration = process.hrtime(start);
    const seconds = duration[0] + duration[1] / 1e9;
    const method = req.method;
    const status = res.statusCode.toString();
    httpRequestsTotal.inc({ method, route: path ?? req.originalUrl, status });
    httpRequestDuration.observe({ method, route: path ?? req.originalUrl }, seconds);
  });
  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', client.register.contentType);
  res.send(await client.register.metrics());
}

export async function healthCheckHandler(_req: Request, res: Response): Promise<void> {
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString(),
    },
  });
}