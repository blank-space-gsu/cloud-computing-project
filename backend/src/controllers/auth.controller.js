import { sendSuccess } from "../utils/apiResponse.js";
import { loginUser, signupUser } from "../services/auth.service.js";
import {
  loginRequestSchema,
  signupRequestSchema
} from "../validators/auth.validator.js";

export const signup = async (request, response) => {
  const payload = signupRequestSchema.parse(request.body);
  const authResult = await signupUser(payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Signup successful. Check your inbox to verify your email.",
    data: authResult
  });
};

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
