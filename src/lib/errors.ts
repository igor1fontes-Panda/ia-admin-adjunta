export class AppError extends Error {
  readonly code: string;
  constructor(message: string, code = "APP_ERROR") {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export class SupabaseError extends AppError {
  constructor(message: string) {
    super(message, "SUPABASE_ERROR");
    this.name = "SupabaseError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
    this.name = "ValidationError";
  }
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
