import { Request, Response, NextFunction } from 'express';
import { logAudit } from '../services/audit.service.js';

export function auditLog(action: string, entity: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const user = (req as any).user;
    logAudit({
      userId: user?.id,
      action,
      entity,
      entityId: req.params.id,
      metadata: { method: req.method, path: req.path },
      ip: req.ip,
      userAgent: req.get('user-agent'),
    }).catch(() => {});
    next();
  };
}
