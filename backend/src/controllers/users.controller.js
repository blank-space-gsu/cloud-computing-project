import { sendSuccess } from "../utils/apiResponse.js";
import {
  createEmployeeForUser,
  getCurrentUserProfile,
  listDirectoryUsersForUser,
  updateCurrentUserProfile,
  updateUserAvatarForUser
} from "../services/user.service.js";
import {
  createEmployeeBodySchema,
  listUsersQuerySchema,
  updateMyProfileBodySchema,
  updateUserAvatarBodySchema,
  userIdParamsSchema
} from "../validators/users.validator.js";

export const getMyProfile = async (request, response) =>
  sendSuccess(response, {
    message: "Current user profile loaded successfully.",
    data: {
      user: getCurrentUserProfile(request.auth.user)
    }
  });

export const updateMyProfile = async (request, response) => {
  const payload = updateMyProfileBodySchema.parse(request.body);
  const user = await updateCurrentUserProfile(request.auth.user, payload);

  return sendSuccess(response, {
    message: "Profile updated successfully.",
    data: {
      user
    }
  });
};

export const listUsers = async (request, response) => {
  const filters = listUsersQuerySchema.parse(request.query);
  const users = await listDirectoryUsersForUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "People directory loaded successfully.",
    data: {
      users
    },
    meta: {
      count: users.length
    }
  });
};

export const createEmployee = async (request, response) => {
  const payload = createEmployeeBodySchema.parse(request.body);
  const user = await createEmployeeForUser(request.auth.user, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Employee created successfully.",
    data: {
      user
    }
  });
};

export const updateUserAvatar = async (request, response) => {
  const { userId } = userIdParamsSchema.parse(request.params);
  const payload = updateUserAvatarBodySchema.parse(request.body);
  const user = await updateUserAvatarForUser(request.auth.user, userId, payload);

  return sendSuccess(response, {
    message: "User avatar updated successfully.",
    data: {
      user
    }
  });
};
