import * as Sentry from "@sentry/nextjs";

import { buildSentryServerOptions } from "@/lib/sentry/options";

Sentry.init(buildSentryServerOptions() as Parameters<typeof Sentry.init>[0]);
