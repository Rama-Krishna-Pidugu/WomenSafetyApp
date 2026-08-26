import * as Sentry from "@sentry/react-native";
import { triggerSentryTestError, reportErrorToSentry } from "./sentry";

jest.mock("@sentry/react-native", () => ({
  captureException: jest.fn(),
  withScope: jest.fn((cb) => {
    const scope = { setExtras: jest.fn() };
    cb(scope);
  }),
}));

describe("sentry utils", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("triggers a test exception and sends to Sentry", () => {
    triggerSentryTestError("Custom error message");
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(expect.any(Error));
  });

  it("reports error to sentry without context", () => {
    const error = new Error("General error");
    reportErrorToSentry(error);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });

  it("reports error to sentry with custom context", () => {
    const error = new Error("Context error");
    reportErrorToSentry(error, { userId: "user-123" });
    expect(Sentry.withScope).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(error);
  });
});
