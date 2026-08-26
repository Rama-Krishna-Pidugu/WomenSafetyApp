import React, { useEffect, useState, useRef } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Modal, Share, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import {
  AlertCircle,
  MapPin,
  Search,
  Check,
  Footprints,
  Bike,
  Car,
  Bus,
  Eye,
  Mic,
  MicOff,
  Sparkles,
  TriangleAlert,
  ShieldCheck,
  Trash2,
  Navigation,
  BatteryMedium,
  Users,
  Siren,
  Volume2,
  ShieldAlert,
  Radio,
  Share2,
  Crosshair,
  Plus,
  Minus,
  ArrowLeft,
  Shield,
  Activity,
  Sliders,
  CheckCircle2,
} from "lucide-react-native";
import { colors, gradientBrand, radii } from "../theme/tokens";
import { AppButton } from "../components/ds/AppButton";
import { Badge } from "../components/ds/Badge";
import { Card } from "../components/ds/Card";
import { NavBar } from "../components/ds/NavBar";
import { ProgressBar } from "../components/ds/ProgressBar";
import { SectionHeader } from "../components/ds/SectionHeader";
import { SelectRow } from "../components/ds/SelectRow";
import { SuccessCheck } from "../components/ds/SuccessCheck";
import { Aurora } from "../components/ds/Aurora";
import {
  LiveTrackingMapView,
  LiveTrackingMapViewRef,
  LatLng,
  RoutePolyline,
  SafeSpotMarker,
} from "../components/app/LiveTrackingMapView";
import { LiveLocationSharingModal } from "../components/app/LiveLocationSharingModal";
import {
  LocationTrackingState,
  AISafetyStatus,
  LOCATION_STATE_META,
} from "../modules/location/types/tracking.types";
import {
  BehaviorAnalysisService,
  BehaviorReport,
  BehaviorSimulator,
  SimulationScenario,
} from "../modules/behavior";
import { NativeEmergencyModule } from "../modules/EmergencyModule";
import { useVoiceState } from "../context/VoiceContext";
import { useJourney } from "../context/JourneyContext";
import { useEmergencyContacts } from "../hooks/useEmergencyContacts";
import {
  JourneyConfig,
  JourneyContact,
  JourneyDestination,
  TransportMode,
} from "../modules/safetyMode/types/journey.types";

const STEP_COUNT = 4;

const PLACES = [
  { id: "p1", name: "Home", detail: "100 Ft Road, Indiranagar", tag: "Recent" },
  { id: "p2", name: "Office", detail: "Prestige Tech Park, Marathahalli", tag: "Saved" },
  { id: "p3", name: "Gym", detail: "Cult Fit, 12th Main Road", tag: "Saved" },
  { id: "p4", name: "Priya's Place", detail: "4th Block, Koramangala", tag: "Recent" },
];

const TRANSPORT = [
  { id: "walk", label: "Walking", detail: "Movement speed & stationary checks", icon: Footprints },
  { id: "bike", label: "Two Wheeler", detail: "Continuous GPS & high-speed route tracking", icon: Bike },
  { id: "cab", label: "Cab / Auto", detail: "Route drift & unexpected stop checks", icon: Car },
  { id: "transit", label: "Public Transit", detail: "Stop notifications & safe exit monitoring", icon: Bus },
];

const DEFAULT_ROUTE_POINTS: Array<[number, number]> = [
  [12.9352, 77.6245], // Office (Koramangala)
  [12.9480, 77.6200],
  [12.9600, 77.6100],
  [12.9716, 77.5946], // Current location
  [12.9780, 77.6000],
  [12.9850, 77.6050], // Home (Indiranagar)
];

const MOCK_SAFE_SPOTS: SafeSpotMarker[] = [
  { id: "sp1", name: "Indiranagar Police Station", type: "police", lat: 12.9755, lng: 77.5990 },
  { id: "sp2", name: "Manipal Hospital 24/7", type: "hospital", lat: 12.9790, lng: 77.6015 },
  { id: "sp3", name: "Women Safe Haven Shelter", type: "shelter", lat: 12.9820, lng: 77.6035 },
];

function StepHeader({ step, title, body, onBack }: { step: number; title: string; body: string; onBack?: () => void }) {
  return (
    <>
      <NavBar onBack={onBack} title={`Step ${step} of ${STEP_COUNT}`} />
      <View style={styles.stepHeaderWrap}>
        <ProgressBar value={step / STEP_COUNT} />
        <Text style={styles.stepHeaderTitle}>{title}</Text>
        <Text style={styles.stepHeaderBody}>{body}</Text>
      </View>
    </>
  );
}

/* Step 1: Destination */
export function JourneyDestinationScreen({
  state = "empty",
  onBack,
  onNext,
}: {
  state?: "empty" | "selected";
  onBack?: () => void;
  onNext?: () => void;
}) {
  const [picked, setPicked] = useState<string | null>(state === "selected" ? "p1" : null);

  return (
    <View style={styles.screen}>
      <StepHeader
        step={1}
        title="Where are you headed?"
        body="We set the destination first, so we can tell the moment you drift off your route."
        onBack={onBack}
      />

      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <Search size={18} color={colors.mutedForeground} />
          <Text style={[styles.searchText, picked ? styles.textForeground : styles.textMuted]}>
            {picked ? PLACES.find((p) => p.id === picked)?.name : "Search a place or address"}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SectionHeader title="Saved & recent" />
        <View style={styles.placesList}>
          {PLACES.map((p) => {
            const isPicked = picked === p.id;
            return (
              <Pressable
                key={p.id}
                onPress={() => setPicked(p.id)}
                style={[styles.placeItem, isPicked && styles.placeItemPicked]}
              >
                <View style={styles.placeIcon}>
                  <MapPin size={18} color={colors.mutedForeground} />
                </View>
                <View style={styles.placeText}>
                  <Text style={styles.placeTitle}>{p.name}</Text>
                  <Text style={styles.placeDetail}>{p.detail}</Text>
                </View>
                {isPicked ? (
                  <LinearGradient colors={gradientBrand as unknown as [string, string, ...string[]]} style={styles.checkBadge}>
                    <Check size={14} color={colors.primaryForeground} strokeWidth={3} />
                  </LinearGradient>
                ) : (
                  <Badge>{p.tag}</Badge>
                )}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton disabled={!picked} onPress={onNext}>
          Continue
        </AppButton>
      </View>
    </View>
  );
}

/* Step 2: Transport */
export function JourneyTransportScreen({
  onBack,
  onNext,
}: {
  onBack?: () => void;
  onNext?: () => void;
}) {
  const [mode, setMode] = useState("cab");

  return (
    <View style={styles.screen}>
      <StepHeader
        step={2}
        title="How are you travelling?"
        body="This tunes how closely we follow your route and what counts as unusual."
        onBack={onBack}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.transportList}>
          {TRANSPORT.map((t) => {
            const Icon = t.icon;
            const selected = mode === t.id;
            return (
              <Pressable
                key={t.id}
                onPress={() => setMode(t.id)}
                style={[styles.transportItem, selected && styles.transportItemSelected]}
              >
                {selected ? (
                  <LinearGradient colors={gradientBrand as unknown as [string, string, ...string[]]} style={styles.transportIconSelected}>
                    <Icon size={20} color={colors.primaryForeground} strokeWidth={2} />
                  </LinearGradient>
                ) : (
                  <View style={styles.transportIcon}>
                    <Icon size={20} color={colors.mutedForeground} strokeWidth={2} />
                  </View>
                )}
                <View style={styles.transportText}>
                  <Text style={styles.transportLabel}>{t.label}</Text>
                  <Text style={styles.transportDetail}>{t.detail}</Text>
                </View>
                {selected ? (
                  <LinearGradient colors={gradientBrand as unknown as [string, string, ...string[]]} style={styles.checkBadge}>
                    <Check size={14} color={colors.primaryForeground} strokeWidth={3} />
                  </LinearGradient>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton onPress={onNext}>Continue</AppButton>
      </View>
    </View>
  );
}

/* Step 3: Contacts */
export function JourneyContactsScreen({
  onBack,
  onNext,
  onContactsSelected,
}: {
  onBack?: () => void;
  onNext?: () => void;
  onContactsSelected?: (contacts: JourneyContact[]) => void;
}) {
  const { contacts: realContacts } = useEmergencyContacts();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    if (realContacts.length > 0 && selectedIds.length === 0) {
      setSelectedIds(realContacts.map((c) => c.id));
    }
  }, [realContacts]);

  const toggle = (id: string) =>
    setSelectedIds((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const handleContinue = () => {
    const selected: JourneyContact[] = realContacts
      .filter((c) => selectedIds.includes(c.id))
      .map((c) => ({ id: c.id, name: c.name, relation: c.relation, phone: c.phone }));
    onContactsSelected?.(selected);
    onNext?.();
  };

  return (
    <View style={styles.screen}>
      <StepHeader
        step={3}
        title="Who should know?"
        body="Chosen contacts will see your live journey. Only they can see it."
        onBack={onBack}
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {realContacts.length === 0 ? (
          <View style={styles.emptyContacts}>
            <Users size={32} color={colors.mutedForeground} />
            <Text style={styles.emptyContactsText}>
              No emergency contacts saved yet.{"\n"}Add contacts in your Profile to share your journey.
            </Text>
          </View>
        ) : (
          <View style={styles.contactsList}>
            {realContacts.map((c) => {
              const checked = selectedIds.includes(c.id);
              return (
                <Pressable key={c.id} onPress={() => toggle(c.id)} style={styles.contactItem}>
                  <View style={styles.contactAvatar}>
                    <Text style={styles.contactInitials}>{c.initials || c.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.contactText}>
                    <Text style={styles.contactName}>{c.name}</Text>
                    <Text style={styles.contactRelation}>{c.relation}</Text>
                  </View>
                  {checked ? (
                    <LinearGradient colors={gradientBrand as unknown as [string, string, ...string[]]} style={styles.checkboxOn}>
                      <Check size={14} color={colors.primaryForeground} strokeWidth={3} />
                    </LinearGradient>
                  ) : (
                    <View style={styles.checkboxOff} />
                  )}
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <AppButton onPress={handleContinue}>Continue</AppButton>
      </View>
    </View>
  );
}

function SafetyModeVoiceCard() {
  const {
    isListening,
    recognitionState,
    recognizedText,
    partialText,
    currentLanguage,
    volumeLevel,
    speechError,
    startListening,
    stopListening,
    changeLanguage,
  } = useVoiceState();

  const { emergencyActive: _isDetected, latestEmergencyEvent } = useJourney();
  const [showLanguages, setShowLanguages] = useState(false);

  const activeTranscript = recognizedText || partialText;
  const isDetected = _isDetected || !!latestEmergencyEvent;

  return (
    <Card style={styles.voiceCard}>
      <View style={styles.voiceHeader}>
        <View style={styles.voiceTitleRow}>
          <Volume2 size={18} color={isListening ? colors.primary : colors.mutedForeground} />
          <Text style={styles.voiceTitle}>Background Voice Detection</Text>
        </View>
        {isDetected ? (
          <Badge tone="emergency">Keyword Detected</Badge>
        ) : isListening ? (
          <Badge tone="success">Listening</Badge>
        ) : recognitionState === "PROCESSING" ? (
          <Badge tone="warning">Processing...</Badge>
        ) : (
          <Badge tone="neutral">Standby</Badge>
        )}
      </View>

      <Text style={styles.voiceSub}>
        Listens for distress keywords like <Text style={{ fontWeight: "700" }}>"Help", "Bachao", "Save me"</Text> to trigger an auto-alert.
      </Text>

      <View style={styles.transcriptBox}>
        <Text style={styles.transcriptLabel}>Live Audio Transcript</Text>
        <Text style={[styles.transcriptText, !activeTranscript && styles.transcriptPlaceholder]}>
          {activeTranscript ? `"${activeTranscript}"` : "Say emergency keywords to trigger SOS..."}
        </Text>

        {isListening && (
          <View style={styles.volumeRow}>
            <Volume2 size={14} color={colors.primary} />
            <View style={styles.volumeTrack}>
              <View style={[styles.volumeFill, { width: `${Math.min(100, volumeLevel * 100)}%` }]} />
            </View>
            <Text style={styles.volumeText}>{Math.round(volumeLevel * 100)}%</Text>
          </View>
        )}
      </View>

      {isDetected && latestEmergencyEvent && (
        <View style={styles.detectedBox}>
          <Sparkles size={18} color={colors.emergency} />
          <View style={styles.detectedTextWrap}>
            <Text style={styles.detectedTitle}>
              Keyword Detected: "{latestEmergencyEvent.detectedKeyword}"
            </Text>
            <Text style={styles.detectedDetail}>
              Confidence: {Math.round((latestEmergencyEvent.confidence || 0) * 100)}% · Language: {latestEmergencyEvent.language || currentLanguage}
            </Text>
          </View>
        </View>
      )}

      {speechError && (
        <View style={styles.errorBox}>
          <AlertCircle size={16} color={colors.emergency} />
          <Text style={styles.errorText}>{speechError}</Text>
        </View>
      )}

      <Pressable onPress={() => setShowLanguages(!showLanguages)} style={styles.langToggle}>
        <Text style={styles.langToggleText}>
          Language: <Text style={styles.langValue}>{currentLanguage}</Text> (Tap to change)
        </Text>
      </Pressable>

      {showLanguages && (
        <View style={styles.langList}>
          {[
            { id: "en-US", label: "English (US)" },
            { id: "hi-IN", label: "Hindi (India)" },
            { id: "ta-IN", label: "Tamil (India)" },
            { id: "te-IN", label: "Telugu (India)" },
            { id: "es-ES", label: "Spanish" },
          ].map((l) => (
            <SelectRow
              key={l.id}
              label={l.label}
              selected={currentLanguage === l.id}
              onPress={() => {
                changeLanguage(l.id as any);
                setShowLanguages(false);
              }}
            />
          ))}
        </View>
      )}

      <AppButton
        variant={isListening ? "secondary" : "primary"}
        size="md"
        leading={isListening ? <MicOff size={16} color={colors.foreground} /> : <Mic size={16} color={colors.primaryForeground} />}
        onPress={isListening ? stopListening : () => startListening(currentLanguage)}
      >
        {isListening ? "Stop Voice Detection" : "Start Voice Detection"}
      </AppButton>
    </Card>
  );
}

/* Step 4: Consent */
export function JourneyConsentScreen({
  onBack,
  onStart,
}: {
  onBack?: () => void;
  onStart?: () => void;
}) {
  const PROMISES = [
    { icon: Eye, title: "We're watching over you", body: "From the moment you start until you arrive, your route is checked continuously." },
    { icon: TriangleAlert, title: "We speak up if something feels off", body: "Off your route, an unusual stop, or no movement — we check in first, then escalate." },
    { icon: ShieldCheck, title: "Your data stays yours", body: "Nothing is sold, shared or published. Only chosen contacts can see this journey." },
    { icon: Trash2, title: "Wipe it whenever you want", body: "Request a full wipe of your journeys anytime from Data & Privacy." },
  ];

  return (
    <View style={styles.screen}>
      <NavBar onBack={onBack} />
      <Aurora />

      <View style={styles.consentHeader}>
        <Text style={styles.consentHeading}>We're here</Text>
        <Text style={styles.consentGradientHeading}>with you.</Text>
        <Text style={styles.consentSub}>Before we begin, here's exactly what happens during a monitored journey.</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <SafetyModeVoiceCard />
        <View style={styles.promisesList}>
          {PROMISES.map(({ icon: Icon, title, body }) => (
            <Card key={title} style={styles.promiseCard}>
              <View style={styles.promiseIconWrap}>
                <Icon size={18} color={colors.primary} strokeWidth={2} />
              </View>
              <View style={styles.promiseTextWrap}>
                <Text style={styles.promiseTitle}>{title}</Text>
                <Text style={styles.promiseBody}>{body}</Text>
              </View>
            </Card>
          ))}
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <AppButton onPress={onStart}>Start monitored journey</AppButton>
      </View>
    </View>
  );
}

/* =========================================================================
   MAIN SCREEN — LIVE JOURNEY / SAFETY MODE (MODULE 4 FULL EXPERIENCE)
   ========================================================================= */
export function JourneyActiveScreen({
  state = "active",
  onEnd,
  onSos,
  onBack,
}: {
  state?: "active" | "offroute" | "escalating";
  onEnd?: () => void;
  onSos?: () => void;
  onBack?: () => void;
}) {
  const { emergencyActive, latestEmergencyEvent, endJourney } = useJourney();
  const mapRef = useRef<LiveTrackingMapViewRef>(null);

  // Core coordinates
  const [userLocation, setUserLocation] = useState<LatLng>({ lat: 12.9716, lng: 77.5946 });
  const [destination] = useState<LatLng>({ lat: 12.9850, lng: 77.6050 });
  const [origin] = useState<LatLng>({ lat: 12.9352, lng: 77.6245 });

  // Location tracking state (10 explicit states)
  const initialLocState: LocationTrackingState =
    state === "escalating"
      ? "ROUTE_DEVIATION"
      : state === "offroute"
      ? "ROUTE_DEVIATION"
      : "ACTIVE";
  const [trackingState, setTrackingState] = useState<LocationTrackingState>(initialLocState);
  const [aiSafetyStatus, setAiSafetyStatus] = useState<AISafetyStatus>(
    state === "escalating" ? "HIGH_RISK" : state === "offroute" ? "ATTENTION" : "NORMAL"
  );

  // Real-time polling metrics
  const [pollingSecAgo, setPollingSecAgo] = useState(3);
  const [gpsAccuracy, setGpsAccuracy] = useState(8);
  const [etaMinutes, setEtaMinutes] = useState(18);
  const [distanceKm, setDistanceKm] = useState(5.4);
  const [progressPercent, setProgressPercent] = useState(state === "offroute" ? 0.52 : 0.68);
  const [batteryLevel] = useState(62);
  const [showSafeSpots, setShowSafeSpots] = useState(true);
  const [showShareModal, setShowShareModal] = useState(false);
  const [isSharingLive, setIsSharingLive] = useState(false);
  const [showStatePicker, setShowStatePicker] = useState(false);
  const [showDebugModal, setShowDebugModal] = useState(false);
  const [behaviorReport, setBehaviorReport] = useState<BehaviorReport | null>(null);

  // GPS Device Watcher & Behavior Analysis Engine
  useEffect(() => {
    let sub: Location.LocationSubscription | null = null;
    let isActive = true;

    // Start Module 18 Behavior Analysis Engine
    void BehaviorAnalysisService.startMonitoring({
      onHighRiskEscalate: () => {
        setAiSafetyStatus("HIGH_RISK");
      },
    });

    const unsubBehavior = BehaviorAnalysisService.subscribe((report) => {
      setBehaviorReport(report);
      if (report.riskLevel === "HIGH") {
        setAiSafetyStatus("HIGH_RISK");
      } else if (report.riskLevel === "ATTENTION") {
        setAiSafetyStatus("ATTENTION");
      } else if (state !== "offroute" && state !== "escalating") {
        setAiSafetyStatus("NORMAL");
      }
    });

    (async () => {
      try {
        if (typeof Location?.requestForegroundPermissionsAsync === "function") {
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status === "granted") {
            sub = await Location.watchPositionAsync(
              {
                accuracy: Location.Accuracy.High,
                timeInterval: 4000, // 4-second throttle
                distanceInterval: 10,
              },
              (pos) => {
                if (isActive) {
                  setUserLocation({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  });
                  setGpsAccuracy(Math.round(pos.coords.accuracy || 8));
                  setPollingSecAgo(0);

                  // Feed telemetry to Behavior Analysis Engine
                  BehaviorAnalysisService.ingestLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    speedMps: pos.coords.speed || 0,
                    headingDegrees: pos.coords.heading || 0,
                    accuracyMeters: pos.coords.accuracy || 8,
                    timestampMs: pos.timestamp,
                  });
                }
              }
            );
          }
        }
        if (isActive && NativeEmergencyModule?.startForegroundNotification) {
          await NativeEmergencyModule.startForegroundNotification();
        }
      } catch (err) {
        console.warn("Safety mode location init error:", err);
      }
    })();

    // Polling simulation timer (calm 1..4s tick)
    const timer = setInterval(() => {
      setPollingSecAgo((prev) => (prev >= 4 ? 1 : prev + 1));
    }, 1000);

    return () => {
      isActive = false;
      sub?.remove();
      clearInterval(timer);
      BehaviorAnalysisService.stopMonitoring();
      unsubBehavior();
      if (NativeEmergencyModule?.stopForegroundNotification) {
        NativeEmergencyModule.stopForegroundNotification().catch(() => {});
      }
    };
  }, []);

  const handleEnd = () => {
    setTrackingState("JOURNEY_COMPLETED");
    endJourney();
    onEnd?.();
  };

  const handleRecenter = () => {
    mapRef.current?.recenter(userLocation.lat, userLocation.lng);
  };

  const handleZoomIn = () => {
    mapRef.current?.zoomIn();
  };

  const handleZoomOut = () => {
    mapRef.current?.zoomOut();
  };

  const handleSharingStateChange = (sharing: boolean) => {
    setIsSharingLive(sharing);
    if (sharing) {
      setTrackingState("SHARING_ACTIVE");
    } else {
      setTrackingState("SHARING_STOPPED");
      setTimeout(() => setTrackingState("ACTIVE"), 2500);
    }
  };

  const routes: RoutePolyline[] = [
    {
      id: "r1",
      points: DEFAULT_ROUTE_POINTS,
      isPrimary: true,
      color: aiSafetyStatus === "ATTENTION" ? colors.warning : colors.primary,
    },
  ];

  const stateMeta = LOCATION_STATE_META[trackingState] || LOCATION_STATE_META.ACTIVE;

  return (
    <View style={styles.fullScreenContainer}>
      {/* ── 1. Full-Screen OpenStreetMap Layer ──────────────────────────────── */}
      <View style={styles.mapLayer}>
        <LiveTrackingMapView
          ref={mapRef}
          userLocation={userLocation}
          destination={destination}
          origin={origin}
          routes={routes}
          safeSpots={showSafeSpots ? MOCK_SAFE_SPOTS : []}
          isFullScreen={true}
        />
      </View>

      {/* ── 2. Floating Minimal Top Bar ─────────────────────────────────────── */}
      <View style={styles.floatingTopBar}>
        <Pressable
          onPress={onBack || onEnd}
          style={styles.floatingIconBtn}
          accessibilityLabel="Back / Minimize"
        >
          <ArrowLeft size={20} color={colors.foreground} />
        </Pressable>

        <View style={styles.floatingTopTitleWrap}>
          <Text style={styles.floatingTopTitle}>Safety Mode</Text>
          <View style={styles.transportTag}>
            <Car size={12} color={colors.primary} />
            <Text style={styles.transportTagText}>Cab / Auto</Text>
          </View>
        </View>

        <View style={styles.floatingLiveBadge}>
          <View style={styles.pulsingLiveDot} />
          <Text style={styles.floatingLiveText}>Live</Text>
        </View>
      </View>

      {/* ── 3. Floating Live Polling Status Pill ─────────────────────────────── */}
      <Pressable
        onPress={() => setShowStatePicker(!showStatePicker)}
        style={[
          styles.pollingStatusPill,
          stateMeta.tone === "warning" && styles.pollingStatusPillWarning,
          stateMeta.tone === "emergency" && styles.pollingStatusPillEmergency,
        ]}
      >
        <View
          style={[
            styles.pollingDot,
            stateMeta.tone === "warning"
              ? styles.pollingDotWarning
              : stateMeta.tone === "emergency"
              ? styles.pollingDotEmergency
              : styles.pollingDotActive,
          ]}
        />
        <Text style={styles.pollingStatusText}>
          {stateMeta.label}
          {trackingState === "ACTIVE"
            ? ` · Updated ${pollingSecAgo}s ago · GPS: ${gpsAccuracy}m`
            : ""}
        </Text>
        <Sliders size={12} color={colors.mutedForeground} style={{ marginLeft: 4 }} />
      </Pressable>

      {/* ── Location State Simulator (Testing / Demo dropdown) ──────────────── */}
      {showStatePicker && (
        <Card style={styles.statePickerCard}>
          <Text style={styles.statePickerHeading}>Location State Demo Switcher</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statePickerScroll}>
            {(
              [
                "GPS_ACQUIRING",
                "ACTIVE",
                "UPDATING",
                "WEAK_SIGNAL",
                "UNAVAILABLE",
                "OFFLINE",
                "ROUTE_DEVIATION",
                "SHARING_ACTIVE",
                "SHARING_STOPPED",
                "JOURNEY_COMPLETED",
              ] as LocationTrackingState[]
            ).map((st) => (
              <Pressable
                key={st}
                onPress={() => {
                  setTrackingState(st);
                  if (st === "ROUTE_DEVIATION") setAiSafetyStatus("ATTENTION");
                  else if (st === "JOURNEY_COMPLETED") setAiSafetyStatus("NORMAL");
                  setShowStatePicker(false);
                }}
                style={[
                  styles.stateChip,
                  trackingState === st && styles.stateChipSelected,
                ]}
              >
                <Text
                  style={[
                    styles.stateChipText,
                    trackingState === st && styles.stateChipTextSelected,
                  ]}
                >
                  {st}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </Card>
      )}

      {/* ── 4. Floating Map Controls (Re-center, Zoom, Safe Spots) ───────────── */}
      <View style={styles.mapControlsWrap}>
        <Pressable
          onPress={handleRecenter}
          style={styles.mapControlBtn}
          accessibilityLabel="Re-center on user position"
        >
          <Crosshair size={20} color={colors.primary} />
        </Pressable>
        <Pressable
          onPress={handleZoomIn}
          style={styles.mapControlBtn}
          accessibilityLabel="Zoom in map"
        >
          <Plus size={20} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={handleZoomOut}
          style={styles.mapControlBtn}
          accessibilityLabel="Zoom out map"
        >
          <Minus size={20} color={colors.foreground} />
        </Pressable>
        <Pressable
          onPress={() => setShowSafeSpots(!showSafeSpots)}
          style={[styles.mapControlBtn, showSafeSpots && styles.mapControlBtnActive]}
          accessibilityLabel="Toggle nearby safe spots"
        >
          <Shield size={18} color={showSafeSpots ? colors.primaryForeground : colors.mutedForeground} />
        </Pressable>
      </View>

      {/* ── 5. Rapido-Inspired Journey Information Bottom Card ───────────────── */}
      <View style={styles.bottomCardWrap}>
        <Card style={styles.journeyInfoCard}>
          <View style={styles.dragHandle} />

          {/* Destination & ETA Header */}
          <View style={styles.journeyHeaderRow}>
            <View style={styles.destInfo}>
              <View style={styles.destIconCircle}>
                <MapPin size={16} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.destTitle}>Home</Text>
                <Text style={styles.destSubtitle}>100 Ft Road, Indiranagar</Text>
              </View>
            </View>

            <View style={styles.etaInfo}>
              <Text style={styles.etaValue}>{etaMinutes} min</Text>
              <Text style={styles.distanceValue}>{distanceKm} km</Text>
            </View>
          </View>

          {/* Subtle Progress Bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressHeaderRow}>
              <Text style={styles.journeyMetaTitle}>Office — Home</Text>
              <Text style={styles.progressPercentText}>{Math.round(progressPercent * 100)}% completed</Text>
            </View>
            <ProgressBar value={progressPercent} />
          </View>

          {/* AI Safety Status Banner */}
          <View
            style={[
              styles.safetyStatusBox,
              aiSafetyStatus === "ATTENTION" && styles.safetyStatusBoxWarning,
              aiSafetyStatus === "HIGH_RISK" && styles.safetyStatusBoxEmergency,
            ]}
          >
            {aiSafetyStatus === "ATTENTION" ? (
              <TriangleAlert size={16} color={colors.warning} />
            ) : aiSafetyStatus === "HIGH_RISK" ? (
              <Siren size={16} color={colors.emergency} />
            ) : (
              <ShieldCheck size={16} color={colors.success} />
            )}
            <View style={styles.safetyStatusTextWrap}>
              <Text style={styles.safetyStatusTitle}>
                {aiSafetyStatus === "ATTENTION"
                  ? behaviorReport?.primaryReason || "Safety status: Attention"
                  : aiSafetyStatus === "HIGH_RISK"
                  ? behaviorReport?.primaryReason || "Safety status: High Risk"
                  : "Safety status: Normal"}
              </Text>
              <Text style={styles.safetyStatusSubtitle}>
                {aiSafetyStatus === "ATTENTION"
                  ? behaviorReport?.reasons?.[0] || "You're moving away from your planned route."
                  : aiSafetyStatus === "HIGH_RISK"
                  ? behaviorReport?.reasons?.[0] || "Unexpected stop detected. Auto-SOS in 00:18."
                  : "You're on your planned route."}
              </Text>
              {aiSafetyStatus === "ATTENTION" && (
                <Pressable
                  onPress={() => {
                    BehaviorAnalysisService.dismissWarning();
                    setAiSafetyStatus("NORMAL");
                  }}
                  style={styles.imSafeBtn}
                  accessibilityLabel="I am safe, dismiss warning"
                >
                  <CheckCircle2 size={12} color={colors.primary} />
                  <Text style={styles.imSafeBtnText}>I'm Safe</Text>
                </Pressable>
              )}
            </View>
            <Badge
              tone={
                aiSafetyStatus === "ATTENTION"
                  ? "warning"
                  : aiSafetyStatus === "HIGH_RISK"
                  ? "emergency"
                  : "success"
              }
            >
              {aiSafetyStatus === "ATTENTION" ? "Attention" : aiSafetyStatus === "HIGH_RISK" ? "Alert" : "On track"}
            </Badge>
          </View>

          {/* Metrics Pill Grid (Required by tests: 9:36 PM, 62%) */}
          <View style={styles.miniMetricsRow}>
            <View style={styles.miniMetric}>
              <Navigation size={13} color={colors.primary} />
              <Text style={styles.miniMetricValue}>9:36 PM</Text>
              <Text style={styles.miniMetricLabel}>Arriving</Text>
            </View>
            <View style={styles.miniMetric}>
              <BatteryMedium size={13} color={colors.success} />
              <Text style={styles.miniMetricValue}>62%</Text>
              <Text style={styles.miniMetricLabel}>Battery</Text>
            </View>
            <Pressable
              onPress={() => setShowDebugModal(true)}
              style={styles.miniMetric}
              accessibilityLabel="Open Behavior Engine Diagnostics"
            >
              <Radio size={13} color={colors.accent} />
              <Text style={styles.miniMetricValue}>4.5s</Text>
              <Text style={styles.miniMetricLabel}>Diagnostics</Text>
            </Pressable>
          </View>

          {/* Primary Action: Share Live Location */}
          <AppButton
            variant={isSharingLive ? "secondary" : "primary"}
            size="md"
            leading={<Share2 size={16} color={isSharingLive ? colors.primary : colors.primaryForeground} />}
            onPress={() => setShowShareModal(true)}
            style={styles.shareBtn}
          >
            {isSharingLive ? "Live Location Shared (3 contacts) · Tap to Manage" : "Share Live Location"}
          </AppButton>

          {/* Action Row: SOS & Arrived */}
          <View style={styles.activeActionsRow}>
            <Pressable onPress={onSos} style={styles.activeActionBtnSos} accessibilityLabel="Trigger SOS Emergency">
              <Siren size={20} color={colors.emergencyForeground} />
              <Text style={styles.activeActionBtnSosText}>SOS</Text>
            </Pressable>
            <Pressable onPress={handleEnd} style={styles.activeActionBtnArrived} accessibilityLabel="End journey / I have arrived">
              <Check size={20} color={colors.foreground} />
              <Text style={styles.activeActionBtnArrivedText}>Arrived</Text>
            </Pressable>
          </View>
        </Card>
      </View>

      {/* ── 6. Full-Screen Live Location Sharing Modal ──────────────────────── */}
      <LiveLocationSharingModal
        visible={showShareModal}
        onClose={() => setShowShareModal(false)}
        userLocation={userLocation}
        destination={destination}
        destinationName="Home"
        routes={routes}
        isAlreadySharing={isSharingLive}
        onSharingStateChange={handleSharingStateChange}
      />

      {/* ── 8. Developer Behavior Debug & Simulation Modal ───────────────────── */}
      <Modal
        visible={showDebugModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDebugModal(false)}
      >
        <View style={styles.debugModalOverlay}>
          <Card style={styles.debugModalCard}>
            <View style={styles.debugModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Activity size={18} color={colors.primary} />
                <Text style={styles.debugModalTitle}>Behavior Engine Diagnostics</Text>
              </View>
              <Pressable onPress={() => setShowDebugModal(false)}>
                <Text style={styles.debugModalClose}>Close</Text>
              </Pressable>
            </View>

            <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ paddingBottom: 16 }}>
              <View style={styles.debugGrid}>
                <View style={styles.debugGridItem}>
                  <Text style={styles.debugLabel}>Activity</Text>
                  <Text style={styles.debugValue}>{behaviorReport?.currentActivity || "WALKING"}</Text>
                </View>
                <View style={styles.debugGridItem}>
                  <Text style={styles.debugLabel}>Speed</Text>
                  <Text style={styles.debugValue}>
                    {behaviorReport?.currentSpeedKmh?.toFixed(1) || "4.8"} km/h
                  </Text>
                </View>
                <View style={styles.debugGridItem}>
                  <Text style={styles.debugLabel}>Heading</Text>
                  <Text style={styles.debugValue}>
                    {Math.round(behaviorReport?.currentHeadingDegrees || 128)}°
                  </Text>
                </View>
                <View style={styles.debugGridItem}>
                  <Text style={styles.debugLabel}>Risk Score</Text>
                  <Text style={[styles.debugValue, { color: colors.primary }]}>
                    {behaviorReport?.riskScore || 0}/100 ({behaviorReport?.riskLevel || "NORMAL"})
                  </Text>
                </View>
              </View>

              <Text style={styles.debugSectionTitle}>TEST SIMULATION SCENARIOS</Text>
              <View style={styles.simButtonsRow}>
                {(
                  [
                    ["Walking", () => BehaviorSimulator.simulateWalking()],
                    ["Running", () => BehaviorSimulator.simulateRunning()],
                    ["Sudden Stop", () => BehaviorSimulator.simulateSuddenStop()],
                    ["Direction Change", () => BehaviorSimulator.simulateDirectionChange()],
                    ["Inactivity", () => BehaviorSimulator.simulateInactivity()],
                    ["Possible Fall", () => BehaviorSimulator.simulatePossibleFall()],
                  ] as Array<[string, () => void]>
                ).map(([label, simFn]) => (
                  <Pressable
                    key={label}
                    onPress={() => {
                      simFn();
                    }}
                    style={styles.simBtn}
                  >
                    <Text style={styles.simBtnText}>{label}</Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </Card>
        </View>
      </Modal>

      {/* ── 7. Emergency Active Overlay ──────────────────────────────────────── */}
      {emergencyActive && (
        <View style={styles.emergencyOverlay}>
          <View style={styles.emergencyOverlayCard}>
            <View style={styles.emergencyOverlayIconRow}>
              <ShieldAlert size={36} color={colors.emergency} />
            </View>
            <Text style={styles.emergencyOverlayTitle}>EMERGENCY DETECTED</Text>
            {latestEmergencyEvent?.detectedKeyword ? (
              <Text style={styles.emergencyOverlayKeyword}>
                Keyword: "{latestEmergencyEvent.detectedKeyword}"
              </Text>
            ) : null}
            <Text style={styles.emergencyOverlayDetail}>
              Distress trigger received. Broadcasting live GPS coordinates to emergency contacts & authorities.
            </Text>
            <Text style={styles.emergencyOverlayContacts}>
              Contacts & Police notified.
            </Text>
            <AppButton
              variant="destructive"
              size="lg"
              leading={<Siren size={20} color="#fff" />}
              style={styles.emergencyOverlaySosBtn}
              onPress={onSos}
            >
              Open SOS Screen
            </AppButton>
            <AppButton
              variant="secondary"
              size="md"
              style={styles.emergencyOverlayEndBtn}
              onPress={handleEnd}
            >
              Cancel / I am Safe
            </AppButton>
          </View>
        </View>
      )}
    </View>
  );
}

/* Journey Summary */
export function JourneySummaryScreen({ onDone }: { onDone?: () => void }) {
  return (
    <View style={styles.summaryScreen}>
      <View style={styles.summaryContent}>
        <SuccessCheck />
        <Text style={styles.summaryTitle}>You're home safe.</Text>
        <Text style={styles.summarySub}>Your emergency contacts have been notified that you've arrived safely.</Text>

        <Card style={styles.summaryCard}>
          <View style={styles.summaryMetricsGrid}>
            <View>
              <Text style={styles.summaryMetricValue}>28m</Text>
              <Text style={styles.summaryMetricLabel}>Duration</Text>
            </View>
            <View>
              <Text style={styles.summaryMetricValue}>8.4 km</Text>
              <Text style={styles.summaryMetricLabel}>Distance</Text>
            </View>
            <View>
              <Text style={styles.summaryMetricValue}>3</Text>
              <Text style={styles.summaryMetricLabel}>Contacts shared</Text>
            </View>
          </View>
        </Card>
      </View>

      <View style={styles.footer}>
        <AppButton onPress={onDone}>Done</AppButton>
      </View>
    </View>
  );
}

/* Main Safety Mode Router Screen */
export function SafetyModeScreen({
  onDone,
  onSos,
}: {
  onDone?: () => void;
  onSos?: () => void;
}) {
  const { isJourneyActive, startJourney, endJourney } = useJourney();

  const [step, setStep] = useState<"destination" | "transport" | "contacts" | "consent" | "active" | "summary">(
    isJourneyActive ? "active" : "destination"
  );

  const [selectedDestination] = useState<JourneyDestination>({ name: "Home", address: "100 Ft Road, Indiranagar" });
  const [selectedTransport] = useState<TransportMode>("cab");
  const [selectedContacts, setSelectedContacts] = useState<JourneyContact[]>([]);

  useEffect(() => {
    if (isJourneyActive && step !== "active" && step !== "summary") {
      setStep("active");
    }
  }, [isJourneyActive]);

  const handleStart = async () => {
    const config: JourneyConfig = {
      destination: selectedDestination,
      transport: selectedTransport,
      contacts: selectedContacts,
    };
    await startJourney(config);
    setStep("active");
  };

  const handleEnd = () => {
    endJourney();
    setStep("summary");
  };

  if (step === "destination") {
    return <JourneyDestinationScreen onBack={onDone} onNext={() => setStep("transport")} />;
  }
  if (step === "transport") {
    return <JourneyTransportScreen onBack={() => setStep("destination")} onNext={() => setStep("contacts")} />;
  }
  if (step === "contacts") {
    return (
      <JourneyContactsScreen
        onBack={() => setStep("transport")}
        onNext={() => setStep("consent")}
        onContactsSelected={(contacts) => setSelectedContacts(contacts)}
      />
    );
  }
  if (step === "consent") {
    return <JourneyConsentScreen onBack={() => setStep("contacts")} onStart={handleStart} />;
  }
  if (step === "active") {
    return <JourneyActiveScreen onEnd={handleEnd} onSos={onSos} onBack={onDone} />;
  }
  return <JourneySummaryScreen onDone={onDone} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  fullScreenContainer: { flex: 1, backgroundColor: colors.background, position: "relative" },
  mapLayer: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  summaryScreen: { flex: 1, backgroundColor: colors.background, justifyContent: "space-between" },
  stepHeaderWrap: { paddingHorizontal: 32, paddingTop: 12, paddingBottom: 16 },
  stepHeaderTitle: { fontSize: 24, fontWeight: "700", color: colors.foreground, marginTop: 16, letterSpacing: -0.2 },
  stepHeaderBody: { fontSize: 14, color: colors.mutedForeground, marginTop: 6, lineHeight: 20 },
  searchWrap: { paddingHorizontal: 32, marginBottom: 8 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    paddingHorizontal: 16,
    height: 48,
    gap: 12,
  },
  searchText: { fontSize: 15 },
  textForeground: { color: colors.foreground, fontWeight: "500" },
  textMuted: { color: colors.mutedForeground },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 32, paddingBottom: 24 },
  placesList: { gap: 10, marginTop: 8 },
  placeItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl2,
    padding: 14,
    gap: 12,
  },
  placeItemPicked: { borderColor: colors.primary, backgroundColor: `${colors.primary}08` },
  placeIcon: { width: 36, height: 36, borderRadius: 12, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  placeText: { flex: 1 },
  placeTitle: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  placeDetail: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  checkBadge: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  transportList: { gap: 12, marginTop: 16 },
  transportItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl,
    padding: 16,
    gap: 14,
  },
  transportItemSelected: { borderColor: colors.primary, backgroundColor: `${colors.primary}08` },
  transportIcon: { width: 44, height: 44, borderRadius: 14, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  transportIconSelected: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  transportText: { flex: 1 },
  transportLabel: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  transportDetail: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  emptyContacts: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 12 },
  emptyContactsText: { fontSize: 14, color: colors.mutedForeground, textAlign: "center", lineHeight: 20 },
  contactsList: { gap: 10 },
  contactItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl2,
    padding: 14,
    gap: 14,
  },
  contactAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center" },
  contactInitials: { fontSize: 15, fontWeight: "700", color: colors.primary },
  contactText: { flex: 1 },
  contactName: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  contactRelation: { fontSize: 13, color: colors.mutedForeground },
  checkboxOn: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  checkboxOff: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: colors.border },
  voiceCard: { padding: 16, marginBottom: 16 },
  voiceHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  voiceTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  voiceTitle: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  voiceSub: { fontSize: 13, color: colors.mutedForeground, lineHeight: 18, marginBottom: 12 },
  transcriptBox: { backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, padding: 12, marginBottom: 12 },
  transcriptLabel: { fontSize: 11, fontWeight: "600", color: colors.mutedForeground, textTransform: "uppercase" },
  transcriptText: { fontSize: 14, color: colors.foreground, marginTop: 4, fontStyle: "italic" },
  transcriptPlaceholder: { color: colors.mutedForeground, fontStyle: "normal" },
  volumeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  volumeTrack: { flex: 1, height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: "hidden" },
  volumeFill: { height: "100%", backgroundColor: colors.primary },
  volumeText: { fontSize: 11, color: colors.mutedForeground, minWidth: 28 },
  detectedBox: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: `${colors.emergency}15`, borderWidth: 1, borderColor: colors.emergency, borderRadius: radii.md, padding: 12, marginBottom: 12 },
  detectedTextWrap: { flex: 1 },
  detectedTitle: { fontSize: 14, fontWeight: "700", color: colors.emergency },
  detectedDetail: { fontSize: 12, color: colors.foreground, marginTop: 2 },
  errorBox: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  errorText: { fontSize: 13, color: colors.emergency },
  langToggle: { marginBottom: 12 },
  langToggleText: { fontSize: 13, color: colors.mutedForeground },
  langValue: { fontWeight: "600", color: colors.foreground },
  langList: { gap: 4, marginBottom: 12 },
  consentHeader: { paddingHorizontal: 32, paddingTop: 16, paddingBottom: 8 },
  consentHeading: { fontSize: 32, fontWeight: "800", color: colors.foreground, letterSpacing: -0.5 },
  consentGradientHeading: { fontSize: 32, fontWeight: "800", color: colors.primary, letterSpacing: -0.5 },
  consentSub: { fontSize: 15, color: colors.mutedForeground, marginTop: 8, lineHeight: 22 },
  promisesList: { gap: 12, marginTop: 12 },
  promiseCard: { flexDirection: "row", gap: 14, padding: 16 },
  promiseIconWrap: { width: 36, height: 36, borderRadius: 12, backgroundColor: `${colors.primary}15`, alignItems: "center", justifyContent: "center" },
  promiseTextWrap: { flex: 1 },
  promiseTitle: { fontSize: 15, fontWeight: "600", color: colors.foreground },
  promiseBody: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, lineHeight: 18 },

  /* ── Floating Top Bar ──────────────────────────── */
  floatingTopBar: {
    position: "absolute",
    top: Platform.OS === "ios" ? 54 : 32,
    left: 20,
    right: 20,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.94)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl2,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    zIndex: 10,
  },
  floatingIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  floatingTopTitleWrap: {
    flex: 1,
    marginLeft: 12,
  },
  floatingTopTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
    letterSpacing: -0.2,
  },
  transportTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 1,
  },
  transportTagText: {
    fontSize: 11,
    fontWeight: "500",
    color: colors.mutedForeground,
  },
  floatingLiveBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.success}18`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 6,
  },
  pulsingLiveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  floatingLiveText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.success,
  },

  /* ── Floating Polling Status Pill ──────────────── */
  pollingStatusPill: {
    position: "absolute",
    top: Platform.OS === "ios" ? 116 : 94,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
    zIndex: 9,
    gap: 6,
  },
  pollingStatusPillWarning: {
    backgroundColor: `${colors.warning}15`,
    borderColor: colors.warning,
  },
  pollingStatusPillEmergency: {
    backgroundColor: `${colors.emergency}15`,
    borderColor: colors.emergency,
  },
  pollingDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pollingDotActive: {
    backgroundColor: colors.success,
  },
  pollingDotWarning: {
    backgroundColor: colors.warning,
  },
  pollingDotEmergency: {
    backgroundColor: colors.emergency,
  },
  pollingStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.foreground,
  },

  /* ── State Picker Dropdown (Demo/Testing) ─────── */
  statePickerCard: {
    position: "absolute",
    top: Platform.OS === "ios" ? 154 : 132,
    left: 20,
    right: 20,
    padding: 12,
    zIndex: 20,
    elevation: 8,
  },
  statePickerHeading: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  statePickerScroll: {
    flexDirection: "row",
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radii.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 6,
  },
  stateChipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  stateChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.foreground,
  },
  stateChipTextSelected: {
    color: colors.primaryForeground,
  },

  /* ── Floating Map Controls ─────────────────────── */
  mapControlsWrap: {
    position: "absolute",
    top: Platform.OS === "ios" ? 160 : 140,
    right: 20,
    gap: 8,
    zIndex: 8,
  },
  mapControlBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  mapControlBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },

  /* ── Rapido Bottom Card ────────────────────────── */
  bottomCardWrap: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
    zIndex: 10,
  },
  journeyInfoCard: {
    padding: 16,
    paddingTop: 8,
    borderRadius: radii.xl3,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
    gap: 12,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  journeyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  destInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  destIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  destTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.foreground,
  },
  destSubtitle: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  etaInfo: {
    alignItems: "flex-end",
  },
  etaValue: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.primary,
  },
  distanceValue: {
    fontSize: 12,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  progressWrap: {
    gap: 4,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  journeyMetaTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.foreground,
  },
  progressPercentText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.mutedForeground,
  },
  safetyStatusBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.success}10`,
    borderWidth: 1,
    borderColor: `${colors.success}30`,
    borderRadius: radii.lg,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 10,
  },
  safetyStatusBoxWarning: {
    backgroundColor: `${colors.warning}15`,
    borderColor: `${colors.warning}40`,
  },
  safetyStatusBoxEmergency: {
    backgroundColor: `${colors.emergency}15`,
    borderColor: `${colors.emergency}40`,
  },
  safetyStatusTextWrap: {
    flex: 1,
  },
  safetyStatusTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.foreground,
  },
  safetyStatusSubtitle: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginTop: 1,
  },
  imSafeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: `${colors.primary}15`,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    marginTop: 4,
  },
  imSafeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.primary,
  },
  debugModalOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  debugModalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl2,
    borderTopRightRadius: radii.xl2,
    padding: 20,
    gap: 12,
  },
  debugModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  debugModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
  },
  debugModalClose: {
    fontSize: 14,
    fontWeight: "600",
    color: colors.primary,
  },
  debugGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
  },
  debugGridItem: {
    width: "48%",
    backgroundColor: colors.background,
    borderRadius: radii.md,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  debugLabel: {
    fontSize: 11,
    color: colors.mutedForeground,
    marginBottom: 2,
  },
  debugValue: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.foreground,
  },
  debugSectionTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.mutedForeground,
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  simButtonsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  simBtn: {
    backgroundColor: `${colors.primary}15`,
    borderRadius: radii.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${colors.primary}30`,
  },
  simBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: colors.primary,
  },
  miniMetricsRow: {
    flexDirection: "row",
    gap: 8,
  },
  miniMetric: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingVertical: 6,
    paddingHorizontal: 8,
    gap: 4,
  },
  miniMetricValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.foreground,
  },
  miniMetricLabel: {
    fontSize: 10,
    color: colors.mutedForeground,
  },
  shareBtn: {
    width: "100%",
  },
  activeActionsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 2,
  },
  activeActionBtnSos: {
    flex: 1,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.emergency,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  activeActionBtnSosText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.emergencyForeground,
  },
  activeActionBtnArrived: {
    flex: 1,
    height: 48,
    borderRadius: radii.xl,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  activeActionBtnArrivedText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.foreground,
  },

  /* ── Emergency Active Overlay ──────────────────── */
  emergencyOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.8)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    zIndex: 99,
  },
  emergencyOverlayCard: {
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.emergency,
    borderRadius: radii.xl2,
    padding: 24,
    width: "100%",
    alignItems: "center",
    gap: 12,
  },
  emergencyOverlayIconRow: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: `${colors.emergency}20`,
    alignItems: "center",
    justifyContent: "center",
  },
  emergencyOverlayTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: colors.emergency,
  },
  emergencyOverlayKeyword: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.foreground,
  },
  emergencyOverlayDetail: {
    fontSize: 13,
    color: colors.mutedForeground,
    textAlign: "center",
  },
  emergencyOverlayContacts: {
    fontSize: 14,
    color: colors.foreground,
    textAlign: "center",
  },
  emergencyOverlaySosBtn: {
    width: "100%",
    marginTop: 8,
  },
  emergencyOverlayEndBtn: {
    width: "100%",
  },

  /* ── Summary Screen ────────────────────────────── */
  summaryContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  summaryTitle: {
    fontSize: 26,
    fontWeight: "700",
    color: colors.foreground,
    marginTop: 20,
    textAlign: "center",
  },
  summarySub: {
    fontSize: 15,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 22,
  },
  summaryCard: {
    width: "100%",
    marginTop: 24,
    padding: 20,
  },
  summaryMetricsGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
  },
  summaryMetricValue: {
    fontSize: 18,
    fontWeight: "700",
    color: colors.foreground,
    textAlign: "center",
  },
  summaryMetricLabel: {
    fontSize: 12,
    color: colors.mutedForeground,
    textAlign: "center",
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 20,
    paddingBottom: 24,
  },
});
