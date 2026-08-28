import * as Sentry from "@sentry/nextjs";

import { buildSentryClientOptions } from "@/lib/sentry/options";

Sentry.init(buildSentryClientOptions() as Parameters<typeof Sentry.init>[0]);

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
