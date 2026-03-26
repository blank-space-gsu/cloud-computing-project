import { sendSuccess } from "../utils/apiResponse.js";
import { getProductivityMetricsForUser } from "../services/productivity.service.js";
import { productivityMetricsQuerySchema } from "../validators/productivity.validator.js";

export const getProductivityMetrics = async (request, response) => {
  const filters = productivityMetricsQuerySchema.parse(request.query);
  const metrics = await getProductivityMetricsForUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "Productivity metrics loaded successfully.",
    data: metrics
  });
};
