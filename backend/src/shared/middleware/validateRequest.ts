import { Request, Response, NextFunction, RequestHandler } from 'express';
import { validationResult } from 'express-validator';
import { ZodSchema, ZodError } from 'zod';
import { AppError } from '../errors/AppError';

/**
 * Middleware: validate using Zod schema on req.body, req.params, or req.query.
 *
 * WHY Zod over express-validator: Zod gives us a single schema definition
 * shared between the API layer (validation) and the service layer (types).
 * No need to maintain separate type definitions and validation rules.
 *
 * Usage:
 *   router.post('/', validate(mySchema), controller.create)
 */
export const validate = <T>(
  schema: ZodSchema<T>,
  source: 'body' | 'params' | 'query' = 'body'
): RequestHandler => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = schema.parse(req[source]);
      // Attach parsed (type-safe, sanitized) data back to request
      req[source] = data as typeof req[typeof source];
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        const errors = err.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        const first = errors[0];
        next(new AppError(`${first.field}: ${first.message}`, 422, 'VALIDATION_ERROR'));
      } else {
        next(err);
      }
    }
  };
};

/**
 * Async handler wrapper — eliminates try/catch boilerplate in every controller.
 *
 * WHY: Express doesn't natively catch async errors. Without this wrapper,
 * every async route handler needs: try { ... } catch(e) { next(e) }
 * This wrapper does that automatically.
 *
 * Usage:
 *   router.get('/', asyncHandler(async (req, res) => { ... }))
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
): RequestHandler => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};
