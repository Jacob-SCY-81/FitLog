import { error } from '../lib/response.js';

export default function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstIssue = result.error.issues[0];
      const msg = firstIssue ? `${firstIssue.path.join('.')}: ${firstIssue.message}` : 'Validation failed';
      return error(res, 400, msg, 'VALIDATION_ERROR');
    }
    req.validatedBody = result.data;
    next();
  };
}
