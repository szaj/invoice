import type { APIResponse, Page } from "@playwright/test";

export function e2eBaseUrl(): string {
  return process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:3000";
}

type ApiJsonResult<T> = {
  readonly response: APIResponse;
  readonly json: T;
};

export async function apiJson<T>(
  page: Page,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<ApiJsonResult<T>> {
  const response = await page.request.fetch(`${e2eBaseUrl()}${path}`, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    data: init?.body,
  });
  const json = (await response.json()) as T;
  return { response, json };
}

export async function apiOk<T extends { ok: boolean }>(
  page: Page,
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  const { response, json } = await apiJson<T>(page, path, init);
  expect(response.ok(), `HTTP ${response.status()} for ${path}`).toBeTruthy();
  expect(json.ok, `API error for ${path}`).toBeTruthy();
  return json;
}
