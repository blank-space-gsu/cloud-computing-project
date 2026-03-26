const buildMeta = (meta = {}) => ({
  timestamp: new Date().toISOString(),
  ...meta
});

export const buildSuccessResponse = ({
  message = "Request completed successfully.",
  data = {},
  meta = {}
} = {}) => ({
  success: true,
  message,
  data,
  meta: buildMeta(meta)
});

export const buildErrorResponse = ({
  code = "INTERNAL_SERVER_ERROR",
  message = "An unexpected error occurred.",
  details = [],
  meta = {}
} = {}) => ({
  success: false,
  error: {
    code,
    message,
    details
  },
  meta: buildMeta(meta)
});

export const sendSuccess = (
  response,
  {
    statusCode = 200,
    message = "Request completed successfully.",
    data = {},
    meta = {}
  } = {}
) => response.status(statusCode).json(buildSuccessResponse({ message, data, meta }));

export const sendError = (
  response,
  {
    statusCode = 500,
    code = "INTERNAL_SERVER_ERROR",
    message = "An unexpected error occurred.",
    details = [],
    meta = {}
  } = {}
) =>
  response
    .status(statusCode)
    .json(buildErrorResponse({ code, message, details, meta }));
