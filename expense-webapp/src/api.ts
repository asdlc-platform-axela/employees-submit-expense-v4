import createClient, { type Middleware } from "openapi-fetch";
import type { paths } from "./generated/expense-api";
import { authorizationHeader, classifyResponse, ForbiddenError } from "./authz/client";

export const expenseApi = createClient<paths>({ baseUrl: "/api" });

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const header = await authorizationHeader();
    if (header) request.headers.set("Authorization", header);
    return request;
  },
  async onResponse({ response }) {
    if ((await classifyResponse(response.status)) === "forbidden") {
      throw new ForbiddenError(response.status);
    }
    return response;
  },
};

expenseApi.use(authMiddleware);
