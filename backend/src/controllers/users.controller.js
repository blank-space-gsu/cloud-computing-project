import { sendSuccess } from "../utils/apiResponse.js";
import { getCurrentUserProfile } from "../services/user.service.js";

export const getMyProfile = async (request, response) =>
  sendSuccess(response, {
    message: "Current user profile loaded successfully.",
    data: {
      user: getCurrentUserProfile(request.auth.user)
    }
  });
