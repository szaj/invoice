import * as Sentry from "@sentry/nextjs";

import { buildSentryEdgeOptions } from "@/lib/sentry/options";

Sentry.init(buildSentryEdgeOptions() as Parameters<typeof Sentry.init>[0]);
