import * as Sentry from "@sentry/react-native";

/**
 * Triggers a test exception and sends it to Sentry.
 * Use this during development or diagnostics to verify error capture.
 */
export function triggerSentryTestError(message = "Test Sentry Error: React Native Frontend Exception"): void {
  try {
    throw new Error(message);
  } catch (error) {
    Sentry.captureException(error);
  }
}

/**
 * Captures an error with optional extra context tags.
 */
export function reportErrorToSentry(error: unknown, context?: Record<string, unknown>): void {
  if (context) {
    Sentry.withScope((scope) => {
      scope.setExtras(context);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}
