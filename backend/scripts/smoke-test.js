import "dotenv/config";

const defaultBaseUrl = `http://localhost:${process.env.PORT ?? "4000"}`;
const baseUrl = (process.env.SMOKE_TEST_BASE_URL ?? defaultBaseUrl).replace(/\/$/, "");
const apiPrefixInput = process.env.API_PREFIX ?? "/api/v1";
const apiPrefix = apiPrefixInput.startsWith("/") ? apiPrefixInput : `/${apiPrefixInput}`;
const apiBaseUrl = `${baseUrl}${apiPrefix}`;
const smokeEmail = process.env.SMOKE_TEST_EMAIL ?? "manager.demo@cloudcomputing.local";
const smokePassword = process.env.SMOKE_TEST_PASSWORD ?? process.env.DEMO_USER_PASSWORD;
const managerAccessExpectation = process.env.SMOKE_TEST_EXPECT_MANAGER_ACCESS;

let checksPassed = 0;

const assertCheck = (condition, label, context = "") => {
  if (!condition) {
    const suffix = context ? ` (${context})` : "";
    throw new Error(`${label}${suffix}`);
  }

  checksPassed += 1;
  console.log(`PASS ${label}`);
};

const parseJson = async (response, label) => {
  try {
    return await response.json();
  } catch (error) {
    throw new Error(`${label} returned a non-JSON response.`);
  }
};

const request = async (path, options = {}) => {
  const targetUrl = `${apiBaseUrl}${path}`;
  const { headers = {}, ...restOptions } = options;

  return fetch(targetUrl, {
    ...restOptions,
    headers: {
      "Content-Type": "application/json",
      ...headers
    }
  });
};

const run = async () => {
  console.log(`Running smoke test against ${apiBaseUrl}`);

  const healthResponse = await request("/health", { method: "GET" });
  const healthPayload = await parseJson(healthResponse, "GET /health");

  assertCheck(healthResponse.status === 200, "GET /health returns 200", `status=${healthResponse.status}`);
  assertCheck(healthPayload.success === true, "GET /health uses success envelope");
  assertCheck(healthPayload.data?.status === "ok", "GET /health reports ok status");
  assertCheck(
    typeof healthPayload.data?.database?.status === "string",
    "GET /health reports database readiness"
  );

  if (!smokePassword) {
    console.log("Skipping authenticated smoke checks because no smoke-test password is configured.");
    console.log(`Smoke test passed: ${checksPassed}/${checksPassed} checks.`);
    return;
  }

  const loginResponse = await request("/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: smokeEmail,
      password: smokePassword
    })
  });
  const loginPayload = await parseJson(loginResponse, "POST /auth/login");

  assertCheck(
    loginResponse.status === 200,
    "POST /auth/login returns 200",
    `status=${loginResponse.status}`
  );
  assertCheck(loginPayload.success === true, "POST /auth/login uses success envelope");

  const accessToken = loginPayload.data?.session?.accessToken;

  assertCheck(typeof accessToken === "string" && accessToken.length > 0, "POST /auth/login returns an access token");
  assertCheck(loginPayload.data?.user?.email === smokeEmail, "POST /auth/login returns the expected user");

  const meResponse = await request("/auth/me", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });
  const mePayload = await parseJson(meResponse, "GET /auth/me");

  assertCheck(meResponse.status === 200, "GET /auth/me returns 200", `status=${meResponse.status}`);
  assertCheck(mePayload.success === true, "GET /auth/me uses success envelope");
  assertCheck(mePayload.data?.user?.email === smokeEmail, "GET /auth/me returns the authenticated user");
  assertCheck(!("accessToken" in (mePayload.data ?? {})), "GET /auth/me does not leak the access token");

  if (managerAccessExpectation === "true" || managerAccessExpectation === "false") {
    const managerAccessResponse = await request("/auth/manager-access", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const managerAccessPayload = await parseJson(managerAccessResponse, "GET /auth/manager-access");
    const expectedStatus = managerAccessExpectation === "true" ? 200 : 403;

    assertCheck(
      managerAccessResponse.status === expectedStatus,
      "GET /auth/manager-access matches the expected RBAC outcome",
      `status=${managerAccessResponse.status}`
    );
    assertCheck(
      managerAccessPayload.success === (managerAccessExpectation === "true"),
      "GET /auth/manager-access uses the expected response envelope"
    );
  }

  console.log(`Smoke test passed: ${checksPassed}/${checksPassed} checks.`);
};

run().catch((error) => {
  console.error(`Smoke test failed after ${checksPassed} successful checks.`);
  console.error(error.message);
  process.exit(1);
});
