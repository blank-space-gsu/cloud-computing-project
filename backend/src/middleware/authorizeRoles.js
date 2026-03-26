import { createAppError } from "../utils/appError.js";

export const authorizeRoles =
  (...allowedRoles) =>
  (request, _response, next) => {
    if (!request.auth?.user) {
      throw createAppError({
        statusCode: 401,
        code: "UNAUTHORIZED",
        message: "Authentication is required before checking roles."
      });
    }

    if (!allowedRoles.includes(request.auth.user.appRole)) {
      throw createAppError({
        statusCode: 403,
        code: "FORBIDDEN",
        message: "You do not have permission to access this resource."
      });
    }

    next();
  };
