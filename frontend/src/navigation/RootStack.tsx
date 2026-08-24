import { FakeCallScreen } from "../screens/FakeCallScreen";
import { IncomingCallScreen } from "../screens/IncomingCallScreen";
import { useEffect, useRef, useState } from "react";
import { Alert, Platform } from "react-native";
import { NavigationContainer, useNavigationContainerRef } from "@react-navigation/native";
import * as Linking from "expo-linking";
import { createNativeStackNavigator, type NativeStackScreenProps } from "@react-navigation/native-stack";

import { SplashScreen } from "../screens/SplashScreen";
import { useShakeDetector } from "../hooks/useShakeDetector";
import { WelcomeScreen } from "../screens/WelcomeScreen";
import { PhoneScreen } from "../screens/PhoneScreen";
import { OtpScreen } from "../screens/OtpScreen";
import { LoginScreen } from "../screens/LoginScreen";
import { OnboardingScreen, ONBOARDING_STEPS } from "../screens/OnboardingScreen";
import {
  SetupNameScreen,
  SetupGenderScreen,
  SetupBloodScreen,
  SetupDobScreen,
  SetupContactsScreen,
  SetupMedicalScreen,
  SetupCompleteScreen,
} from "../screens/SetupScreens";
import { PermissionScreen, PERMISSIONS } from "../screens/PermissionScreens";
import { HomeScreen } from "../screens/HomeScreen";
import { SafetyScreen } from "../screens/SafetyScreen";
import { SafetyModeScreen } from "../screens/SafetyModeScreens";
import { HistoryScreen, IncidentDetailScreen } from "../screens/HistoryScreens";
import { ProfileScreen, SettingsScreen, DataPrivacyScreen, ManageContactsScreen } from "../screens/ProfileScreens";
import { SosScreen, type SosState } from "../screens/SosScreen";
import { SafeRouteScreen } from "../screens/SafeRouteScreen";
import { FamilyLiveTrackingScreen } from "../screens/FamilyLiveTrackingScreen";
import { NearbyHelpScreen } from "../screens/NearbyHelpScreen";
import { AssistantScreen } from "../screens/AssistantScreen";
import { ReportScreen } from "../screens/ReportScreen";
import { CommunityReportsScreen } from "../screens/CommunityReportsScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { HomeStubScreen } from "../screens/HomeStubScreen";
import { WearableScreen } from "../screens/WearableScreen";
import { IncidentsScreen } from "../screens/IncidentsScreen";
import { NewIncidentScreen } from "../screens/NewIncidentScreen";
import { UploadEvidenceScreen } from "../screens/UploadEvidenceScreen";
import { EvidenceDetailScreen } from "../screens/EvidenceDetailScreen";
import { AdminAuthScreen } from "../screens/AdminAuthScreen";
import { AdminDashboardScreen } from "../screens/AdminDashboardScreen";
import { AdminUsersScreen } from "../screens/AdminUsersScreen";
import { AdminIncidentsScreen } from "../screens/AdminIncidentsScreen";
import { VoiceTriggerConfigScreen, VoiceTrainingScreen } from "../modules/voice";
import { loadAdminSession, adminLogout } from "../data/adminAuth";
import { type TabKey } from "../components/app/BottomNav";
import { saveProfile, clearCurrentProfile } from "../services/profileService";
import { contactStorageService } from "../services/contactStorageService";
import { API_BASE_URL } from "../api/config";
import { getAuthHeader, setPhoneConfirmation, getPhoneConfirmation } from "../services/firebaseConfig";
import { addEmergencyActionListener } from "../modules/EmergencyModule";
import { FaceVerificationScreen, FaceRegistrationScreen } from "../modules/face";

export type RootStackParamList = {
  Splash: undefined;
  Onboarding: undefined;
  Welcome: undefined;
  Phone: undefined;
  Otp: { phone: string } | undefined;
  Login: undefined;
  Setup: undefined;
  Permissions: undefined;
  Home: undefined;
  FakeCall: undefined;
  IncomingCall: undefined;
  Safety: undefined;
  SafetyMode: undefined;
  History: undefined;
  Profile: undefined;
  Sos: { state?: SosState } | undefined;
  SafeRoute: undefined;
  NearbyHelp: undefined;
  Assistant: undefined;
  Report: undefined;
  CommunityReports: undefined;
  Notifications: undefined;
  Settings: undefined;
  DataPrivacy: undefined;
  ManageContacts: undefined;
  NewIncident: undefined;
  IncidentDetail: { incidentId?: string; id?: string } | undefined;
  UploadEvidence: { incidentId?: string } | undefined;
  EvidenceDetail: { id?: string } | undefined;
  HomeStub: undefined;
  Wearable: undefined;
  AdminDashboard: undefined;
  AdminUsers: undefined;
  AdminIncidents: undefined;
  FaceVerification: undefined;
  FaceRegistration: undefined;
  VoiceTriggerConfig: undefined;
  VoiceTraining: undefined;
  FamilyLiveTracking: {
    sessionId?: string;
    destinationName?: string;
    destinationLat?: number;
    destinationLng?: number;
  } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
type P<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

function SplashRouteScreen({ navigation }: P<"Splash">) {
  useEffect(() => {
    const t = setTimeout(() => navigation.replace("Onboarding"), 2600);
    return () => clearTimeout(t);
  }, [navigation]);
  return <SplashScreen />;
}

function OnboardingRouteScreen({ navigation }: P<"Onboarding">) {
  const [step, setStep] = useState(0);
  const isLast = step === ONBOARDING_STEPS.length - 1;
  return (
    <OnboardingScreen
      step={step}
      onSkip={() => navigation.replace("Welcome")}
      onNext={() => (isLast ? navigation.replace("Welcome") : setStep(step + 1))}
    />
  );
}

function WelcomeRouteScreen({ navigation }: P<"Welcome">) {
  return (
    <WelcomeScreen
      onContinue={() => navigation.navigate("Phone")}
      onSecureLogin={() => navigation.navigate("Login")}
    />
  );
}

function LoginRouteScreen({ navigation }: P<"Login">) {
  return (
    <LoginScreen
      onBack={() => navigation.goBack()}
      onLoggedIn={() => navigation.replace("Home")}
      onUsePhoneOtp={() => navigation.replace("Phone")}
    />
  );
}

function PhoneRouteScreen({ navigation }: P<"Phone">) {
  return (
    <PhoneScreen
      onBack={() => navigation.goBack()}
      onContinue={(phone, confirmation) => {
        clearCurrentProfile();
        setPhoneConfirmation(confirmation);
        navigation.navigate("Otp", { phone });
      }}
    />
  );
}

function OtpRouteScreen({ navigation, route }: P<"Otp">) {
  const phone = route.params?.phone;
  const confirmation = getPhoneConfirmation();

  return (
    <OtpScreen
      phone={phone}
      confirmation={confirmation}
      onBack={() => navigation.goBack()}
      onVerified={(hasProfile) => {
        if (hasProfile) {
          navigation.replace("Home");
        } else {
          navigation.replace("Setup");
        }
      }}
    />
  );
}

const SETUP_ORDER = ["Name", "Gender", "Blood", "Birthday", "Contacts", "Medical", "Done"] as const;
type SetupStep = (typeof SETUP_ORDER)[number];

function SetupRouteScreen({ navigation }: P<"Setup">) {
  const [step, setStep] = useState<SetupStep>("Name");
  const [saving, setSaving] = useState(false);

  const profileData = useRef<{
    full_name?: string;
    gender?: string;
    blood_group?: string;
    date_of_birth?: string;
    medical_notes?: string;
  }>({});

  const go = (s: SetupStep) => setStep(s);
  const back = () => go(SETUP_ORDER[Math.max(SETUP_ORDER.indexOf(step) - 1, 0)]);

  const advanceTo = (nextStep: SetupStep) => go(nextStep);

  const handleSaveAndComplete = async () => {
    setSaving(true);
    try {
      const savedProfile = await saveProfile(profileData.current);
      const userId = savedProfile?.id;

      if (userId) {
        const storedContacts = await contactStorageService.getStoredEmergencyContacts();
        if (storedContacts && storedContacts.length > 0) {
          const authHeader = await getAuthHeader();
          for (let i = 0; i < storedContacts.length; i++) {
            const contact = storedContacts[i];
            try {
              await fetch(`${API_BASE_URL}/emergency/contacts`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...authHeader },
                body: JSON.stringify({
                  user_id: userId,
                  name: contact.name,
                  phone: contact.phone,
                  relationship: contact.relation || "FRIEND",
                  priority: contact.priority ?? i + 1,
                }),
              });
            } catch (cErr) {
              console.warn("Failed to sync onboarding contact to backend:", cErr);
            }
          }
        }
      }

      setSaving(false);
      navigation.replace("Permissions");
    } catch (err: any) {
      setSaving(false);
      console.warn("Could not save profile to backend/database:", err);
      Alert.alert(
        "Couldn't save your profile",
        "We weren't able to reach the server to save your safety profile. Check your connection and try again.",
        [
          { text: "Continue anyway", style: "destructive", onPress: () => navigation.replace("Permissions") },
          { text: "Retry", onPress: handleSaveAndComplete },
        ]
      );
    }
  };

  if (step === "Name")
    return (
      <SetupNameScreen
        onBack={back}
        onNext={(name) => {
          profileData.current.full_name = name;
          advanceTo("Gender");
        }}
      />
    );
  if (step === "Gender")
    return (
      <SetupGenderScreen
        onBack={back}
        onNext={(gender) => {
          profileData.current.gender = gender;
          advanceTo("Blood");
        }}
      />
    );
  if (step === "Blood")
    return (
      <SetupBloodScreen
        onBack={back}
        onNext={(blood) => {
          profileData.current.blood_group = blood;
          advanceTo("Birthday");
        }}
      />
    );
  if (step === "Birthday")
    return (
      <SetupDobScreen
        onBack={back}
        onNext={(dob) => {
          profileData.current.date_of_birth = dob;
          advanceTo("Contacts");
        }}
      />
    );
  if (step === "Contacts") return <SetupContactsScreen onBack={back} onNext={() => advanceTo("Medical")} onSkip={() => advanceTo("Medical")} />;
  if (step === "Medical")
    return (
      <SetupMedicalScreen
        onBack={back}
        onNext={(info) => {
          const parts: string[] = [];
          if (info?.allergies?.trim()) parts.push(`Allergies: ${info.allergies.trim()}`);
          if (info?.conditions?.trim()) parts.push(`Conditions: ${info.conditions.trim()}`);
          if (info?.notes?.trim()) parts.push(`Notes: ${info.notes.trim()}`);
          profileData.current.medical_notes = parts.length > 0 ? parts.join(" • ") : undefined;
          advanceTo("Done");
        }}
        onSkip={() => advanceTo("Done")}
      />
    );
  return <SetupCompleteScreen onDone={handleSaveAndComplete} />;
}

function PermissionsRouteScreen({ navigation }: P<"Permissions">) {
  const [index, setIndex] = useState(0);
  const skipToHome = () => navigation.replace("Home");
  const next = () => {
    if (index >= PERMISSIONS.length - 1) {
      navigation.replace("Home");
      return;
    }
    setIndex((i) => i + 1);
  };
  return <PermissionScreen key={index} index={index} onAllow={next} onSkip={skipToHome} />;
}

function HomeRouteScreen({ navigation }: P<"Home">) {
  return (
    <HomeScreen
      onSos={() => navigation.navigate("Sos", { state: "active" })}
      onNotifications={() => navigation.navigate("Notifications")}
      onSafetyMode={() => navigation.navigate("SafetyMode")}
      onAssistant={() => navigation.navigate("Assistant")}
      onQuickAction={(action: string) => {
        if (action === "Safe Route") navigation.navigate("SafeRoute");
        else if (action === "Nearby Police" || action === "Hospitals") navigation.navigate("NearbyHelp");
        else if (action === "AI Assistant") navigation.navigate("Assistant");
        else if (action === "Report Area") navigation.navigate("Report");
        else if (action === "Contacts") navigation.navigate("Profile");
        else if (action === "Fake Call") navigation.navigate("IncomingCall");
        else if (action === "Register Face") navigation.navigate("FaceRegistration");

        else if (action === "Voice SOS") navigation.navigate("VoiceTriggerConfig");
        else if (action === "Fake Call") navigation.navigate("IncomingCall");
      }}
      onQuickActionLongPress={(action: string) => {
        if (action === "Fake Call") navigation.navigate("FakeCall");
      }}
      onQuickActionLongPress={(action: string) => {
        if (action === "Fake Call") navigation.navigate("FakeCall");
      }}
      onTab={(t: TabKey) => {
        if (t === "safety") navigation.navigate("Safety");
        else if (t === "history") navigation.navigate("History");
        else if (t === "profile") navigation.navigate("Profile");
      }}
    />
  );
}

function SafetyRouteScreen({ navigation }: P<"Safety">) {
  return (
    <SafetyScreen
      onTab={(t: TabKey) => {
        if (t === "home") navigation.navigate("Home");
        else if (t === "history") navigation.navigate("History");
        else if (t === "profile") navigation.navigate("Profile");
      }}
      onSafetyMode={() => navigation.navigate("SafetyMode")}
      onSafeRoute={() => navigation.navigate("SafeRoute")}
      onNearby={() => navigation.navigate("NearbyHelp")}
      onContacts={() => navigation.navigate("Profile")}
      onAssistant={() => navigation.navigate("Assistant")}
      onSos={() => navigation.navigate("Sos", { state: "active" })}
    />
  );
}

function SafetyModeRouteScreen({ navigation }: P<"SafetyMode">) {
  return (
    <SafetyModeScreen
      onDone={() => navigation.navigate("Home")}
      onSos={() => navigation.navigate("Sos", { state: "active" })}
    />
  );
}

function HistoryRouteScreen({ navigation }: P<"History">) {
  return (
    <HistoryScreen
      onTab={(t: TabKey) => {
        if (t === "home") navigation.navigate("Home");
        else if (t === "safety") navigation.navigate("Safety");
        else if (t === "profile") navigation.navigate("Profile");
      }}
      onOpen={(incidentId?: string) => navigation.navigate("IncidentDetail", { incidentId })}
      onAssistant={() => navigation.navigate("Assistant")}
      onSos={() => navigation.navigate("Sos", { state: "active" })}
    />
  );
}

function IncidentDetailRouteScreen({ route, navigation }: P<"IncidentDetail">) {
  const incidentId = route.params?.incidentId || route.params?.id || "";
  return (
    <IncidentDetailScreen
      incidentId={incidentId}
      onBack={() => navigation.goBack()}
    />
  );
}

function ProfileRouteScreen({ navigation }: P<"Profile">) {
  return (
    <ProfileScreen
      onTab={(t: TabKey) => {
        if (t === "home") navigation.navigate("Home");
        else if (t === "safety") navigation.navigate("Safety");
        else if (t === "history") navigation.navigate("History");
      }}
      onSettings={() => navigation.navigate("Settings")}
      onPrivacy={() => navigation.navigate("DataPrivacy")}
      onAssistant={() => navigation.navigate("Assistant")}
      onSos={() => navigation.navigate("Sos", { state: "active" })}
      onManageContacts={() => navigation.navigate("ManageContacts")}
      onLoggedOut={() => navigation.reset({ index: 0, routes: [{ name: "Welcome" }] })}
    />
  );
}

function ManageContactsRouteScreen({ navigation }: P<"ManageContacts">) {
  return <ManageContactsScreen onBack={() => navigation.goBack()} />;
}

function SosRouteScreen({ navigation, route }: P<"Sos">) {
  const sosState = route.params?.state ?? "active";
  return (
    <SosScreen
      state={sosState}
      onEnd={() => navigation.setParams({ state: "confirm" })}
      onCancelConfirm={() => navigation.navigate("FaceVerification")}
      onDone={() => navigation.replace("Home")}
    />
  );
}

function FaceVerificationRouteScreen({
  navigation,
}: P<"FaceVerification">) {
  return (
    <FaceVerificationScreen
      onVerified={() => navigation.replace("Home")}
      onFailed={() => navigation.goBack()}
    />
  );
}

function FaceRegistrationRouteScreen({
  navigation,
}: P<"FaceRegistration">) {
  return (
    <FaceRegistrationScreen
      onDone={() => navigation.goBack()}
    />
  );
}

function ReportRouteScreen({ navigation }: P<"Report">) {
  return (
    <ReportScreen
      onBack={() => navigation.goBack()}
      onSubmitDone={() => navigation.replace("Home")}
      onViewCommunity={() => navigation.replace("CommunityReports")}
    />
  );
}



function CommunityReportsRouteScreen({ navigation }: P<"CommunityReports">) {
  return <CommunityReportsScreen onBack={() => navigation.goBack()} onReportNew={() => navigation.navigate("Report")} />;
}

function NewIncidentRouteScreen({ navigation }: P<"NewIncident">) {
  return <NewIncidentScreen onBack={() => navigation.goBack()} onCreated={(id) => navigation.replace("IncidentDetail", { id })} />;
}

function UploadEvidenceRouteScreen({ navigation, route }: P<"UploadEvidence">) {
  return <UploadEvidenceScreen incidentId={route.params?.incidentId} onBack={() => navigation.goBack()} onDone={() => navigation.goBack()} />;
}

function EvidenceDetailRouteScreen({ navigation, route }: P<"EvidenceDetail">) {
  return <EvidenceDetailScreen id={route.params?.id} onBack={() => navigation.goBack()} />;
}

function FakeCallRouteScreen({ navigation }: P<"FakeCall">) {
  return <FakeCallScreen onBack={() => navigation.goBack()} />;
}

function IncomingCallRouteScreen({ navigation }: P<"IncomingCall">) {
  return <IncomingCallScreen />;
}

function FamilyLiveTrackingRouteScreen({ navigation, route }: P<"FamilyLiveTracking">) {
  return (
    <FamilyLiveTrackingScreen
      sessionId={route.params?.sessionId}
      destinationName={route.params?.destinationName}
      destinationLat={route.params?.destinationLat}
      destinationLng={route.params?.destinationLng}
      onBack={() => navigation.goBack()}
      onEmergencyAlert={() => navigation.navigate("Sos", { state: "active" })}
    />
  );
}
function AdminDashboardRouteScreen({ navigation }: P<"AdminDashboard">) {
  return (
    <AdminDashboardScreen
      onBack={() => navigation.goBack()}
      onUsers={() => navigation.navigate("AdminUsers")}
      onIncidents={() => navigation.navigate("AdminIncidents")}
    />
  );
}

function AdminUsersRouteScreen({ navigation }: P<"AdminUsers">) {
  return <AdminUsersScreen onBack={() => navigation.goBack()} />;
}

function AdminIncidentsRouteScreen({ navigation }: P<"AdminIncidents">) {
  return <AdminIncidentsScreen onBack={() => navigation.goBack()} />;
}

function WebAdminNavigator({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Stack.Navigator initialRouteName="AdminDashboard" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="AdminDashboard">
        {({ navigation }: P<"AdminDashboard">) => (
          <AdminDashboardScreen
            onUsers={() => navigation.navigate("AdminUsers")}
            onIncidents={() => navigation.navigate("AdminIncidents")}
            onSignOut={onSignOut}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="AdminUsers" component={AdminUsersRouteScreen} />
      <Stack.Screen name="AdminIncidents" component={AdminIncidentsRouteScreen} />
    </Stack.Navigator>
  );
}

function WebAdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    let alive = true;
    loadAdminSession().then((ok: boolean) => alive && setAuthed(ok));
    return () => {
      alive = false;
    };
  }, []);
  if (authed === null) return null;
  if (!authed) return <AdminAuthScreen onAuthed={() => setAuthed(true)} />;
  return (
    <NavigationContainer>
      <WebAdminNavigator onSignOut={() => void adminLogout().then(() => setAuthed(false))} />
    </NavigationContainer>
  );
}

function MobileApp() {
  const navigationRef = useNavigationContainerRef<RootStackParamList>();

  useShakeDetector(() => {
    if (navigationRef.isReady()) {
      navigationRef.navigate("Sos", { state: "active" });
    }
  });

  useEffect(() => {
    const subscription = addEmergencyActionListener((action: string) => {
      if (navigationRef.isReady()) {
        if (action === "SOS") {
          navigationRef.navigate("Sos", { state: "active" });
        } else if (action === "LIVE_LOCATION") {
          navigationRef.navigate("Home");
        }
      }
    });
    return () => subscription.remove();
  }, [navigationRef]);

  const linking = {
    prefixes: [Linking.createURL("/"), "aegis://", "aegiswomensafety://"],
    config: {
      screens: {
        IncomingCall: "fakecall",
      },
    },
  };

  return (
    <NavigationContainer ref={navigationRef} linking={linking}>
      <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Splash" component={SplashRouteScreen} />
        <Stack.Screen name="Onboarding" component={OnboardingRouteScreen} />
        <Stack.Screen name="Welcome" component={WelcomeRouteScreen} />
        <Stack.Screen name="Login" component={LoginRouteScreen} />
        <Stack.Screen name="Phone" component={PhoneRouteScreen} />
        <Stack.Screen name="Otp" component={OtpRouteScreen} />
        <Stack.Screen name="Setup" component={SetupRouteScreen} />
        <Stack.Screen name="Permissions" component={PermissionsRouteScreen} />
        <Stack.Screen name="Home" component={HomeRouteScreen} options={{ animation: "none" }} />
        <Stack.Screen name="Safety" component={SafetyRouteScreen} options={{ animation: "none" }} />
        <Stack.Screen name="SafetyMode" component={SafetyModeRouteScreen} />
        <Stack.Screen name="History" component={HistoryRouteScreen} options={{ animation: "none" }} />
        <Stack.Screen name="Profile" component={ProfileRouteScreen} options={{ animation: "none" }} />
        <Stack.Screen name="Sos" component={SosRouteScreen} />
        <Stack.Screen name="SafeRoute">
          {({ navigation }: P<"SafeRoute">) => (
            <SafeRouteScreen
              onBack={() => navigation.goBack()}
              onOpenFamilyTracking={(params) => navigation.navigate("FamilyLiveTracking", params)}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="FamilyLiveTracking" component={FamilyLiveTrackingRouteScreen} />
        <Stack.Screen name="FaceVerification" component={FaceVerificationRouteScreen} />
        <Stack.Screen name="FaceRegistration" component={FaceRegistrationRouteScreen} />
        <Stack.Screen name="NearbyHelp" component={NearbyHelpScreen} />
        <Stack.Screen name="Assistant" component={AssistantScreen} />
        <Stack.Screen name="Report" component={ReportRouteScreen} />
        <Stack.Screen name="CommunityReports" component={CommunityReportsRouteScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen name="Settings" component={SettingsScreen} />
        <Stack.Screen name="DataPrivacy" component={DataPrivacyScreen} />
        <Stack.Screen name="ManageContacts" component={ManageContactsRouteScreen} />
        <Stack.Screen name="NewIncident" component={NewIncidentRouteScreen} />
        <Stack.Screen name="IncidentDetail" component={IncidentDetailRouteScreen} />
        <Stack.Screen name="UploadEvidence" component={UploadEvidenceRouteScreen} />
        <Stack.Screen name="EvidenceDetail" component={EvidenceDetailRouteScreen} />
        <Stack.Screen name="HomeStub" component={HomeStubScreen} />
        <Stack.Screen name="Wearable" component={WearableScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboardRouteScreen} />
        <Stack.Screen name="AdminUsers" component={AdminUsersRouteScreen} />
        <Stack.Screen name="AdminIncidents" component={AdminIncidentsRouteScreen} />
        <Stack.Screen name="VoiceTriggerConfig" component={VoiceTriggerConfigScreen} />
        <Stack.Screen name="VoiceTraining" component={VoiceTrainingScreen} />
        <Stack.Screen name="FakeCall" component={FakeCallRouteScreen} />
        <Stack.Screen name="IncomingCall" component={IncomingCallRouteScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export function RootStack() {
  return Platform.OS === "web" ? <WebAdminApp /> : <MobileApp />;
}

