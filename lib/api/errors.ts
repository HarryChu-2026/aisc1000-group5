import { z } from "zod";

const statusCodes = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_FAILED: 422,
  PROFILE_INCOMPLETE: 409,
  SYNC_COOLDOWN: 429,
  GMAIL_REVOKED: 409,
  LLM_UNAVAILABLE: 503,
  FORM_UNREACHABLE: 502,
  DEADLINE_PASSED: 409,
  DUPLICATE_REGISTRATION: 409,
  RATE_LIMITED: 429,
  INTERNAL: 500,
} as const;

export class AppError extends Error {
  constructor(
    readonly code: keyof typeof statusCodes,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  const issue = error instanceof z.ZodError
    ? new AppError("VALIDATION_FAILED", "Check the highlighted fields.", {
      fields: error.issues.map(({ path, message }) => ({ field: path.join("."), message })),
    })
    : error instanceof AppError ? error : new AppError("INTERNAL", "Something went wrong. Please try again.");
  return Response.json({
    error: { code: issue.code, message: issue.message, details: issue.details },
  }, { status: statusCodes[issue.code], headers: { "Cache-Control": "no-store" } });
}
