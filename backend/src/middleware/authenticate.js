import { resolveAuthenticatedUser } from "../services/auth.service.js";
import { createAppError } from "../utils/appError.js";

export const extractBearerToken = (authorizationHeader) => {
  if (!authorizationHeader) {
    throw createAppError({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header is required."
    });
  }

  const [scheme, token, ...rest] = authorizationHeader.trim().split(/\s+/);

  if (scheme?.toLowerCase() !== "bearer" || !token || rest.length > 0) {
    throw createAppError({
      statusCode: 401,
      code: "UNAUTHORIZED",
      message: "Authorization header must use the Bearer scheme."
    });
  }

  return token;
};

export const createAuthenticate = (
  resolveUserContext = resolveAuthenticatedUser
) =>
  async (request, _response, next) => {
    const accessToken = extractBearerToken(request.headers.authorization);
    const authContext = await resolveUserContext(accessToken);

    request.auth = authContext;
    next();
  };

const authenticate = createAuthenticate();

export default authenticate;
