import "server-only";

import { selectEffectiveRate } from "@/domain/fixed-rates/resolve-rate";
import type { EffectiveRateResult } from "@/domain/fixed-rates/types";
import { PrismaFixedConversionRateStore } from "@/server/fixed-rates/fixed-rate-repository";

export interface ResolveRateDependencies {
  readonly store: Pick<PrismaFixedConversionRateStore, "listRatesForPair">;
}

export function createDefaultResolveRateDependencies(): ResolveRateDependencies {
  return {
    store: new PrismaFixedConversionRateStore(),
  };
}

/**
 * resolve_rate(pair, at) — select the Admin fixed rate effective at `at`.
 * Later conversion/settlement/payment paths must call this service.
 * Does not require Admin permission (callers enforce their own authz).
 * Never substitutes a market or gateway rate.
 */
export async function resolveFixedConversionRate(
  fromCurrency: string,
  toCurrency: string,
  at: Date,
  deps: ResolveRateDependencies = createDefaultResolveRateDependencies(),
): Promise<EffectiveRateResult> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();

  if (from === to) {
    return selectEffectiveRate([], from, to, at);
  }

  const candidates = await deps.store.listRatesForPair(from, to);
  return selectEffectiveRate(candidates, from, to, at);
}
