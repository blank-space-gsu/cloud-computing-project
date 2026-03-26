import { ZodError } from "zod";
import { sendError } from "../utils/apiResponse.js";

const POSTGRES_ERROR_MAPPINGS = {
  "22007": {
    statusCode: 400,
    code: "INVALID_INPUT",
    message: "Request contained an invalid date or time value."
  },
  "22P02": {
    statusCode: 400,
    code: "INVALID_INPUT",
    message: "Request contained an invalid value."
  },
  "23502": {
    statusCode: 400,
    code: "INVALID_INPUT",
    message: "A required value is missing."
  },
  "23503": {
    statusCode: 409,
    code: "REFERENCE_CONSTRAINT_VIOLATION",
    message: "Request references a record that does not exist or cannot be changed."
  },
  "23505": {
    statusCode: 409,
    code: "CONFLICT",
    message: "A record with these values already exists."
  },
  "23514": {
    statusCode: 400,
    code: "CONSTRAINT_VIOLATION",
    message: "Request violates a data constraint."
  }
};

const isJsonBodyParseError = (error) =>
  error?.type === "entity.parse.failed" ||
  (error instanceof SyntaxError && error.status === 400 && Object.hasOwn(error, "body"));

export const notFoundHandler = (request, response, next) => {
  const error = new Error(`Route not found: ${request.method} ${request.originalUrl}`);
  error.statusCode = 404;
  error.code = "NOT_FOUND";
  error.details = [];

  next(error);
};

export const errorHandler = (error, request, response, _next) => {
  let statusCode = error.statusCode ?? 500;
  let code = error.code ?? "INTERNAL_SERVER_ERROR";
  let message = error.message ?? "An unexpected error occurred.";
  let details = Array.isArray(error.details) ? error.details : [];

  if (error instanceof ZodError) {
    statusCode = 400;
    code = "VALIDATION_ERROR";
    message = "Request validation failed.";
    details = error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }));
  }

  if (isJsonBodyParseError(error)) {
    statusCode = 400;
    code = "INVALID_JSON";
    message = "Request body contains invalid JSON.";
    details = [];
  }

  if (POSTGRES_ERROR_MAPPINGS[error.code]) {
    statusCode = POSTGRES_ERROR_MAPPINGS[error.code].statusCode;
    code = POSTGRES_ERROR_MAPPINGS[error.code].code;
    message = POSTGRES_ERROR_MAPPINGS[error.code].message;
    details = error.detail
      ? [
          {
            message: error.detail
          }
        ]
      : [];
  }

  if (statusCode >= 500) {
    console.error("Unhandled application error", {
      code,
      message,
      path: request.originalUrl,
      method: request.method,
      stack: error.stack
    });
  }

  return sendError(response, {
    statusCode,
    code,
    message,
    details,
    meta: {
      path: request.originalUrl,
      method: request.method
    }
  });
};
