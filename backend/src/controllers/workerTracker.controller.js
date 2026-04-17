import { sendSuccess } from "../utils/apiResponse.js";
import { getWorkerTrackerForUser } from "../services/workerTracker.service.js";
import { workerTrackerQuerySchema } from "../validators/workerTracker.validator.js";

export const getWorkerTracker = async (request, response) => {
  const filters = workerTrackerQuerySchema.parse(request.query);
  const tracker = await getWorkerTrackerForUser(request.auth.user, filters);

  return sendSuccess(response, {
    message: "Worker Tracker loaded successfully.",
    data: tracker
  });
};
