import { sendSuccess } from "../utils/apiResponse.js";
import { loginUser } from "../services/auth.service.js";
import { loginRequestSchema } from "../validators/auth.validator.js";

export const login = async (request, response) => {
  const credentials = loginRequestSchema.parse(request.body);
  const authResult = await loginUser(credentials);

  return sendSuccess(response, {
    message: "Login successful.",
    data: authResult
  });
};

export const getCurrentUser = async (request, response) =>
  sendSuccess(response, {
    message: "Authenticated user loaded successfully.",
    data: {
      user: request.auth.user
    }
  });
