import { runKeepaliveCheck } from "../services/keepalive.service.js";
import { sendSuccess } from "../utils/apiResponse.js";

export const getKeepalive = async (request, response) => {
  const keepalive = await runKeepaliveCheck();

  return sendSuccess(response, {
    message: "Keepalive check completed.",
    data: keepalive,
    meta: {
      path: request.originalUrl,
      method: request.method
    }
  });
};
