import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Sentry from "@sentry/react-native";
import { RootStack } from "./src/navigation/RootStack";
import {
  AuthProvider,
  EmergencyProvider,
  VoiceProvider,
  AIProvider,
  JourneyProvider,
} from "./src/context";

// Suppress on-screen developer warning/error toast overlays in demo/user UI
LogBox.ignoreAllLogs(true);

const SENTRY_DSN =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  "https://1a49203a7a9168221a0f2e5e217ea18e@o4511977779036161.ingest.us.sentry.io/4511977802825728";

Sentry.init({
  dsn: SENTRY_DSN,
  sendDefaultPii: true,
  tracesSampleRate: __DEV__ ? 1.0 : 0.2,
  environment: __DEV__ ? "development" : "production",
  debug: __DEV__,
});

function App() {
  return (
    <SafeAreaProvider testID="app-root">
      <AuthProvider>
        <VoiceProvider>
          <EmergencyProvider>
            {/*
              JourneyProvider is inside VoiceProvider (consumes voice transcripts)
              and beside EmergencyProvider (both are independent safety-mode services).
              It has NO dependency on AIProvider.
            */}
            <JourneyProvider>
              <AIProvider>
                <RootStack />
              </AIProvider>
            </JourneyProvider>
          </EmergencyProvider>
        </VoiceProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

export default Sentry.wrap(App);
