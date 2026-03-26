import { sendSuccess } from "../utils/apiResponse.js";
import {
  getEmployeeDashboardForUser,
  getManagerDashboardForUser
} from "../services/dashboard.service.js";
import { managerDashboardQuerySchema } from "../validators/dashboard.validator.js";

export const getEmployeeDashboard = async (request, response) => {
  const dashboard = await getEmployeeDashboardForUser(request.auth.user);

  return sendSuccess(response, {
    message: "Employee dashboard loaded successfully.",
    data: dashboard
  });
};

export const getManagerDashboard = async (request, response) => {
  const filters = managerDashboardQuerySchema.parse(request.query);
  const dashboard = await getManagerDashboardForUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "Manager dashboard loaded successfully.",
    data: dashboard
  });
};
