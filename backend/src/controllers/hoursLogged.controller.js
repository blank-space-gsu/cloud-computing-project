import { sendSuccess } from "../utils/apiResponse.js";
import {
  createHoursLogForUser,
  listHoursLogsForUser
} from "../services/hoursLogged.service.js";
import {
  createHoursLogBodySchema,
  listHoursLogsQuerySchema
} from "../validators/hoursLogged.validator.js";

export const listHoursLogged = async (request, response) => {
  const filters = listHoursLogsQuerySchema.parse(request.query);
  const result = await listHoursLogsForUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "Hours logged entries loaded successfully.",
    data: {
      hoursLogs: result.hoursLogs,
      summary: result.summary,
      charts: result.charts
    },
    meta: {
      count: result.hoursLogs.length,
      total: result.total,
      page: filters.page,
      limit: filters.limit
    }
  });
};

export const createHoursLoggedHandler = async (request, response) => {
  const payload = createHoursLogBodySchema.parse(request.body);
  const hoursLog = await createHoursLogForUser(request.auth.user, payload);

  return sendSuccess(response, {
    statusCode: 201,
    message: "Hours log created successfully.",
    data: {
      hoursLog
    }
  });
};
