import "server-only";

import { headers } from "next/headers";

export async function getRequestClientKey(): Promise<string> {
  const headerList = await headers();
  const forwarded = headerList.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || headerList.get("x-real-ip")?.trim();
  return ip && ip.length > 0 ? ip : "unknown";
}

export function getRequestClientKeyFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim();
  return ip && ip.length > 0 ? ip : "unknown";
}

export async function getRequestUserAgent(): Promise<string | null> {
  const headerList = await headers();
  const userAgent = headerList.get("user-agent")?.trim();
  return userAgent && userAgent.length > 0 ? userAgent : null;
}

export function getRequestUserAgentFromRequest(request: Request): string | null {
  const userAgent = request.headers.get("user-agent")?.trim();
  return userAgent && userAgent.length > 0 ? userAgent : null;
}

export interface RequestAuditMeta {
  readonly ipAddress: string;
  readonly userAgent: string | null;
}

export async function getRequestAuditMeta(): Promise<RequestAuditMeta> {
  return {
    ipAddress: await getRequestClientKey(),
    userAgent: await getRequestUserAgent(),
  };
}

export function getRequestAuditMetaFromRequest(request: Request): RequestAuditMeta {
  return {
    ipAddress: getRequestClientKeyFromRequest(request),
    userAgent: getRequestUserAgentFromRequest(request),
  };
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    return true;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
