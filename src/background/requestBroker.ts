import { hasHostPermission } from "./permissions";

export interface BrokerFetchInput {
  profileId: string;
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  timeoutMs?: number;
  requireHostPermission?: boolean;
}

export class BrokerRequestError extends Error {
  constructor(
    message: string,
    readonly status = 0,
    readonly profileId = "unknown",
  ) {
    super(message);
    this.name = "BrokerRequestError";
  }
}

export async function brokerFetch(input: BrokerFetchInput): Promise<Response> {
  const timeoutMs = input.timeoutMs ?? 30000;
  if (input.requireHostPermission !== false && !(await hasHostPermission(input.url))) {
    throw new BrokerRequestError(
      `Missing host permission for ${new URL(input.url).origin}. Grant provider permission in Options.`,
      0,
      input.profileId,
    );
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const init: RequestInit = {
      method: input.method ?? "GET",
      signal: controller.signal,
    };
    if (input.headers) init.headers = input.headers;
    if (input.body !== undefined) init.body = input.body;
    const response = await fetch(input.url, init);
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new BrokerRequestError(
        `${input.profileId} request failed with ${response.status}: ${body.slice(0, 240)}`,
        response.status,
        input.profileId,
      );
    }
    return response;
  } catch (error) {
    if (error instanceof BrokerRequestError) throw error;
    const message = error instanceof Error ? error.message : String(error);
    throw new BrokerRequestError(`${input.profileId} request failed: ${message}`, 0, input.profileId);
  } finally {
    clearTimeout(timeout);
  }
}

export async function brokerJson<T>(input: BrokerFetchInput): Promise<T> {
  const response = await brokerFetch(input);
  return response.json() as Promise<T>;
}

export async function brokerText(input: BrokerFetchInput): Promise<string> {
  const response = await brokerFetch(input);
  return response.text();
}
