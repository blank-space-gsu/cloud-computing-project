import { sendSuccess } from "../utils/apiResponse.js";
import { createRecurringTaskRuleForUser } from "../services/recurringTaskRule.service.js";
import { createRecurringTaskRuleBodySchema } from "../validators/recurringTaskRules.validator.js";

export const createRecurringTaskRuleHandler = async (request, response) => {
  const payload = createRecurringTaskRuleBodySchema.parse(request.body);
  const recurringTaskRule = await createRecurringTaskRuleForUser(
    request.auth.user,
    payload
  );

  return sendSuccess(response, {
    statusCode: 201,
    message: "Recurring task rule created successfully.",
    data: {
      recurringTaskRule
    }
  });
};
