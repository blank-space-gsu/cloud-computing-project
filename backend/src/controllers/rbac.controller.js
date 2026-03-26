import { sendSuccess } from "../utils/apiResponse.js";

export const getManagerAccessCheck = async (request, response) =>
  sendSuccess(response, {
    message: "Manager access confirmed.",
    data: {
      role: request.auth.user.appRole
    }
  });
