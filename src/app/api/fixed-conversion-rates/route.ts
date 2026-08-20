import { NextResponse } from "next/server";

import { GENERIC_FORBIDDEN } from "@/domain/authz/errors";
import { FIXED_RATE_INVALID_INPUT } from "@/domain/fixed-rates/types";
import { isSameOriginRequest } from "@/server/auth/request";
import { getRequestAuthorizationPrincipal } from "@/server/authz/require-permission";
import {
  createFixedConversionRate,
  listFixedConversionRates,
} from "@/server/fixed-rates/fixed-rate-service";

export async function GET(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  const url = new URL(request.url);
  const fromCurrency = url.searchParams.get("fromCurrency")?.toUpperCase() || undefined;
  const toCurrency = url.searchParams.get("toCurrency")?.toUpperCase() || undefined;

  const actor = await getRequestAuthorizationPrincipal();
  const result = await listFixedConversionRates(actor, { fromCurrency, toCurrency });
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, rates: result.data });
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json({ ok: false, error: GENERIC_FORBIDDEN }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: FIXED_RATE_INVALID_INPUT }, { status: 400 });
  }

  const actor = await getRequestAuthorizationPrincipal();
  const result = await createFixedConversionRate(actor, body);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ ok: true, rate: result.data }, { status: 201 });
}
