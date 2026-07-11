export class AppError extends Error {
  constructor(code, message, component, status = 400, details = null) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.component = component;
    this.status = status;
    this.details = details;
  }
}

export function errorDetails(error) {
  if (error instanceof AppError) return error;
  return new AppError(
    "INTERNAL_ERROR",
    error instanceof Error ? error.message : String(error),
    "worker",
    500
  );
}
