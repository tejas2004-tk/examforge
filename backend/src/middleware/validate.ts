import { NextFunction, Request, Response } from 'express';
import { AnyZodObject, ZodError } from 'zod';
import { AppError } from '../utils/errors.js';

export const validate =
  (schema: AnyZodObject) => (req: Request, _res: Response, next: NextFunction) => {
    try {
      const result = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      req.body = result.body;
      req.query = result.query as typeof req.query;
      req.params = result.params as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        throw new AppError(400, 'Validation failed', error.flatten().fieldErrors);
      }
      throw error;
    }
  };
