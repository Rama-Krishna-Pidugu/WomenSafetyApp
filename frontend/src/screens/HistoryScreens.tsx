import { useState, useEffect } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import {
  Siren,
  Route as RouteIcon,
  Flag,
  AlertTriangle,
  Search,
  Download,
  Sparkles,
  Mic,
  Video,
} from "lucide-react-native";
import { colors, radii } from "../theme/tokens";
import { AppButton } from "../components/ds/AppButton";
import { Badge } from "../components/ds/Badge";
import { Card } from "../components/ds/Card";
import { Chip } from "../components/ds/Chip";
import { EmptyState } from "../components/ds/EmptyState";
import { NavBar } from "../components/ds/NavBar";
import { TimelineItem, type TimelineTone } from "../components/ds/TimelineItem";
import { BottomNav, type TabKey } from "../components/app/BottomNav";
import {
  getIncidents,
  getIncidentById,
  type SOSIncident,
  type SOSLogEntry,
} from "../services/sosOrchestratorService";
import { fetchIncidentHistory } from "../services/incidentSyncService";
import { auth } from "../services/firebaseConfig";
import {
  EVENT_DISPLAY_CONFIG,
  IncidentEventRecord,
  IncidentEventType,
} from "../data/incidentEvents";
import { fetchIncidentTimeline } from "../data/timelineService";

const MOCK_INCIDENTS = [
  { id: "mock-1", kind: "journey" as const, title: "Monitored walk", place: "Indiranagar to Koramangala", date: "10 Jun", status: "safe" as const },
  { id: "mock-2", kind: "report" as const, title: "Area report", place: "5th Cross stretch", date: "04 Jun", status: "under-review" as const },
];

const STATUS = {
  resolved: { label: "Resolved", tone: "success" as const },
  active:   { label: "Active", tone: "warning" as const },
  safe: { label: "Arrived safely", tone: "success" as const },
  "under-review": { label: "Under review", tone: "warning" as const },
  cancelled: { label: "Cancelled", tone: "neutral" as const },
};

const FILTERS = ["All", "SOS", "Journeys", "Reports"];

function formatDate(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

export type HistoryState = "default" | "empty" | "loading";

export function HistoryScreen({
  state = "default",
  onTab,
  onOpen,
  onAssistant,
  onSos,
}: {
  state?: HistoryState;
  onTab?: (t: TabKey) => void;
  onOpen?: (incidentId: string) => void;
  onAssistant?: () => void;
  onSos?: () => void;
}) {
  const [filter, setFilter] = useState("All");
  const [realSosIncidents, setRealSosIncidents] = useState<SOSIncident[]>([]);
  const [loadingIncidents, setLoadingIncidents] = useState(true);
  const [hasPendingSync, setHasPendingSync] = useState(false);

  useEffect(() => {
    getIncidents()
      .then(setRealSosIncidents)
      .catch(() => setRealSosIncidents([]))
      .finally(() => setLoadingIncidents(false));

    fetchIncidentHistory().then((remoteIncidents) => {
      if (remoteIncidents.length === 0) return;
      setRealSosIncidents((current) => {
        const localIds = new Set(current.map((i) => i.id));
        const missingFromLocal = remoteIncidents.filter((r) => !localIds.has(r.clientIncidentId));
        if (missingFromLocal.length === 0) return current;
        const merged: SOSIncident[] = missingFromLocal.map((r) => ({
          id: r.clientIncidentId,
          source: (r.source as SOSIncident["source"]) ?? "BUTTON",
          startTime: new Date(r.startedAt).getTime(),
          endTime: r.endedAt ? new Date(r.endedAt).getTime() : undefined,
          status: (r.status as SOSIncident["status"]) ?? "resolved",
          location:
            r.latitude != null && r.longitude != null
              ? { lat: r.latitude, lon: r.longitude, timestamp: new Date(r.startedAt).getTime(), accurate: true }
              : null,
          contactsNotified: [],
          timeline: [],
        }));
        return [...current, ...merged].sort((a, b) => b.startTime - a.startTime);
      });
    });
  }, []);

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>History</Text>
        <Text style={styles.headerSub}>Every journey, alert and report — kept only on your account.</Text>
      </View>

      {hasPendingSync && (
        <View style={styles.syncWarningBanner}>
          <AlertTriangle size={15} color={colors.warning} />
          <Text style={styles.syncWarningText}>Some incident information hasn't synced yet.</Text>
        </View>
      )}

      {state !== "empty" ? (
        <>
          <View style={styles.searchWrap}>
            <View style={styles.searchBar}>
              <Search size={17} color={colors.mutedForeground} />
              <Text style={styles.searchText}>Search history</Text>
            </View>
          </View>
          <View style={styles.filtersRow}>
            {FILTERS.map((f) => (
              <Chip key={f} active={filter === f} onPress={() => setFilter(f)}>
                {f}
              </Chip>
            ))}
          </View>
        </>
      ) : null}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {state === "empty" ? (
          <EmptyState
            title="Nothing here yet"
            body="Your journeys, alerts and reports will appear here as a simple timeline."
            action={<AppButton size="md">Start a journey</AppButton>}
          />
        ) : (
          <View style={styles.listSection}>
            {!loadingIncidents && realSosIncidents.length > 0 && (
              <>
                <Text style={styles.monthHeader}>SOS INCIDENTS</Text>
                {realSosIncidents.map((inc) => {
                  const st = STATUS[inc.status as keyof typeof STATUS] ?? STATUS.cancelled;
                  const locText = inc.location
                    ? `${inc.location.lat.toFixed(4)}, ${inc.location.lon.toFixed(4)}`
                    : "Location unavailable";
                  const triggerLabel =
                    inc.source === "SHAKE" ? "Shake trigger" : "Button trigger";
                  return (
                    <Pressable key={inc.id} onPress={() => onOpen?.(inc.id)} style={styles.incidentCard}>
                      <View style={[styles.incidentIconWrap, styles.iconWrapSos]}>
                        <Siren size={20} color={colors.emergency} />
                      </View>
                      <View style={styles.incidentTextWrap}>
                        <View style={styles.incidentTopRow}>
                          <Text style={styles.incidentTitle}>SOS — {triggerLabel}</Text>
                          <Text style={styles.incidentDate}>{formatDate(inc.startTime)}</Text>
                        </View>
                        <Text style={styles.incidentPlace}>{locText}</Text>
                        <Text style={styles.incidentTime}>{formatTime(inc.startTime)}</Text>
                      </View>
                      <Badge tone={st.tone as any}>{st.label}</Badge>
                    </Pressable>
                  );
                })}
              </>
            )}

            <Text style={styles.monthHeader}>JUNE 2026</Text>
            {MOCK_INCIDENTS.map((it) => {
              const Icon = it.kind === "journey" ? RouteIcon : Flag;
              const st = STATUS[it.status as keyof typeof STATUS] ?? STATUS.cancelled;
              return (
                <Pressable key={it.id} onPress={() => onOpen?.(it.id)} style={styles.incidentCard}>
                  <View style={[styles.incidentIconWrap]}>
                    <Icon size={20} color={colors.primary} />
                  </View>
                  <View style={styles.incidentTextWrap}>
                    <View style={styles.incidentTopRow}>
                      <Text style={styles.incidentTitle}>{it.title}</Text>
                      <Text style={styles.incidentDate}>{it.date}</Text>
                    </View>
                    <Text style={styles.incidentPlace}>{it.place}</Text>
                  </View>
                  <Badge tone={st.tone as any}>{st.label}</Badge>
                </Pressable>
              );
            })}
          </View>
        )}
      </ScrollView>

      <BottomNav active="history" onSelect={onTab} onAssistant={onAssistant} onSos={onSos} />
    </View>
  );
}



const STEP_LABELS: Record<string, { title: string; tone: TimelineTone }> = {
  SOS_TRIGGERED: { title: "SOS triggered", tone: "emergency" },
  LOCATION_ACQUIRED: { title: "Location acquired", tone: "brand" },
  SMS_SENT: { title: "Contacts notified", tone: "brand" },
  SMS_SKIPPED: { title: "No contacts configured", tone: "warning" },
  CALL_PLACED: { title: "Call placed to primary contact", tone: "brand" },
  LIVE_TRACKING_STARTED: { title: "Live location tracking started", tone: "brand" },
  LIVE_TRACKING_FAILED: { title: "Live location tracking failed", tone: "warning" },
  LOCATION_UPDATE: { title: "Location updated", tone: "brand" },
  AUDIO_STARTED: { title: "Audio recording started", tone: "brand" },
  AUDIO_STOPPED: { title: "Audio evidence saved", tone: "success" },
  PHOTO_CAPTURED: { title: "Photo evidence captured", tone: "brand" },
  VIDEO_STARTED: { title: "Video recording started", tone: "brand" },
  VIDEO_STOPPED: { title: "Video evidence saved", tone: "success" },
  SOS_ENDED: { title: "Emergency ended", tone: "success" },
  AI_WARNING: { title: "AI Pre-Warning Triggered", tone: "warning" },
  AI_RISK_DETECTED: { title: "AI Threat Detected", tone: "warning" },
};

function describeTimelineStep(entry: SOSLogEntry | IncidentEventRecord): { time: string; title: string; detail?: string; tone: TimelineTone } {
  if ("event_type" in entry) {
    const cfg = EVENT_DISPLAY_CONFIG[entry.event_type as IncidentEventType] ?? {
      title: entry.title || entry.event_type,
      tone: "brand" as const,
    };
    const timeStr = entry.created_at
      ? formatTime(new Date(entry.created_at).getTime())
      : "";
    return {
      time: timeStr,
      title: entry.title || cfg.title,
      detail: entry.description ?? (entry.metadata ? JSON.stringify(entry.metadata) : undefined),
      tone: cfg.tone as TimelineTone,
    };
  }

  const label = STEP_LABELS[entry.step] ?? { title: entry.step, tone: "brand" as const };
  let detail: string | undefined;
  if (entry.step === "SMS_SENT" && Array.isArray(entry.data?.numbers)) {
    detail = `Sent to ${(entry.data!.numbers as string[]).length} contact(s).`;
  } else if (entry.step === "LOCATION_ACQUIRED" || entry.step === "LOCATION_UPDATE") {
    const lat = entry.data?.lat;
    const lon = entry.data?.lon;
    if (typeof lat === "number" && typeof lon === "number") {
      detail = `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  } else if (entry.step === "AUDIO_STARTED") {
    detail = "Continuous audio recording active.";
  } else if (entry.step === "AUDIO_STOPPED") {
    const dur = entry.data?.durationSeconds;
    const seal = entry.data?.tamperSeal;
    detail = `Saved ${dur ? `${dur}s audio clip` : "audio evidence"}${seal ? ` · ${seal}` : ""}.`;
  } else if (entry.step === "PHOTO_CAPTURED") {
    const count = entry.data?.count || 2;
    const hash = (entry.data?.frontSha256 as string) || (entry.data?.frontSeal as string);
    const shortHash = hash ? (hash.startsWith("seal:") ? hash : `SHA-256: ${hash.slice(0, 8)}…${hash.slice(-4)}`) : "";
    const upload = entry.data?.uploadStatus === "UPLOADED" ? "Uploaded to cloud" : "Saved locally (Upload: Pending)";
    detail = `Auto-captured ${count} photos of surroundings${shortHash ? ` · ${shortHash}` : ""} · Status: ${upload}.`;
  } else if (entry.step === "VIDEO_STARTED") {
    detail = "Continuous video recording active · Status: Saved locally (Upload: Pending).";
  } else if (entry.step === "VIDEO_STOPPED") {
    const dur = entry.data?.durationSeconds;
    const hash = entry.data?.sha256 as string;
    const shortHash = hash ? `SHA-256: ${hash.slice(0, 8)}…${hash.slice(-4)}` : "";
    detail = `Saved ${dur ? `${dur}s video clip` : "video recording"}${shortHash ? ` · ${shortHash}` : ""} · Status: Saved locally.`;
  } else if (entry.step === "SOS_ENDED" && typeof entry.data?.status === "string") {
    detail = `Marked as ${entry.data.status}.`;
  } else if (
    (entry.step === "AI_WARNING" || entry.step === "AI_RISK_DETECTED") &&
    typeof entry.data?.detail === "string"
  ) {
    detail = entry.data.detail;
  }
  return { time: formatTime(entry.timestamp), title: label.title, detail, tone: label.tone };
}

export function IncidentDetailScreen({
  incidentId,
  id,
  onBack,
}: {
  incidentId?: string;
  id?: string;
  onBack?: () => void;
}) {
  const [incident, setIncident] = useState<SOSIncident | null | undefined>(undefined);
  const [timelineEvents, setTimelineEvents] = useState<IncidentEventRecord[]>([]);

  useEffect(() => {
    if (!incidentId) {
      setIncident(null);
      return;
    }
    getIncidentById(incidentId)
      .then((found) => setIncident(found ?? null))
      .catch(() => setIncident(null));

    fetchIncidentTimeline(incidentId)
      .then(setTimelineEvents)
      .catch(() => setTimelineEvents([]));
  }, [incidentId]);

  if (incident === undefined) {
    return (
      <View style={styles.screen}>
        <NavBar title="Incident details" onBack={onBack} />
      </View>
    );
  }

  if (incident === null) {
    return (
      <View style={styles.screen}>
        <NavBar title="Incident details" onBack={onBack} />
        <View style={styles.scrollContent}>
          <Text style={styles.detailHeaderTitle}>Incident not found</Text>
        </View>
      </View>
    );
  }

  const st = STATUS[incident.status as keyof typeof STATUS] ?? STATUS.cancelled;
  const triggerLabel = incident.source === "SHAKE" ? "Shake trigger" : "Button trigger";
  const locText = incident.location
    ? `${incident.location.lat.toFixed(4)}, ${incident.location.lon.toFixed(4)}`
    : "Location unavailable";

  const displayTimeline =
    incident.timeline && incident.timeline.length > 0
      ? incident.timeline
      : timelineEvents;

  return (
    <View style={styles.screen}>
      <NavBar
        title="Incident details"
        onBack={onBack}
        action={
          <View style={styles.downloadIconBtn}>
            <Download size={17} color={colors.foreground} />
          </View>
        }
      />

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.detailHeaderRow}>
          <View style={styles.sosHeaderIcon}>
            <Siren size={24} color={colors.emergency} />
          </View>
          <View style={styles.detailHeaderTextWrap}>
            <Text style={styles.detailHeaderTitle}>SOS — {triggerLabel}</Text>
            <Text style={styles.detailHeaderSub}>
              {formatDate(incident.startTime)} · {formatTime(incident.startTime)} · {locText}
            </Text>
            <View style={styles.badgeWrap}>
              <Badge tone={st.tone as any}>{st.label}</Badge>
            </View>
          </View>
        </View>

        <Text style={styles.sectionHeading}>TIMELINE</Text>
        <Card style={styles.sectionCard}>
          {displayTimeline.map((entry, i) => {
            const step = describeTimelineStep(entry);
            const keyStr = "step" in entry ? `${entry.step}-${entry.timestamp}-${i}` : `${entry.id}-${entry.created_at}-${i}`;
            return (
              <TimelineItem
                key={keyStr}
                time={step.time}
                title={step.title}
                detail={step.detail}
                tone={step.tone}
                last={i === displayTimeline.length - 1}
              />
            );
          })}
        </Card>

        {incident.contactsNotified && incident.contactsNotified.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>CONTACTS NOTIFIED</Text>
            <Card style={styles.sectionCard}>
              {incident.contactsNotified.map((phone) => (
                <Text key={phone} style={styles.aiBullet}>• {phone}</Text>
              ))}
            </Card>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitle: { fontSize: 28, fontWeight: "700", color: colors.foreground, letterSpacing: -0.3 },
  headerSub: { fontSize: 15, color: colors.mutedForeground, marginTop: 4 },
  syncWarningBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: `${colors.warning}15`,
    borderColor: `${colors.warning}40`,
    borderWidth: 1,
    borderRadius: 12,
    marginHorizontal: 20,
    marginBottom: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  syncWarningText: {
    fontSize: 13,
    color: colors.warning,
    fontWeight: "500",
  },
  searchWrap: { paddingHorizontal: 20, marginBottom: 8 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    height: 48,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 14,
    gap: 10,
  },
  searchText: { fontSize: 15, color: colors.mutedForeground },
  filtersRow: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingVertical: 8 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 24 },
  listSection: { gap: 12, marginTop: 8 },
  monthHeader: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.5 },
  incidentCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.xl2,
    padding: 16,
    gap: 12,
  },
  incidentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${colors.primary}15`,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapSos: { backgroundColor: `${colors.emergency}15` },
  incidentTextWrap: { flex: 1 },
  incidentTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  incidentTitle: { fontSize: 16, fontWeight: "600", color: colors.foreground },
  incidentDate: { fontSize: 12, color: colors.mutedForeground },
  incidentPlace: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  incidentTime: { fontSize: 11, color: colors.mutedForeground, marginTop: 1 },
  badgeWrap: { marginTop: 8, alignSelf: "flex-start" },
  downloadIconBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: colors.border, alignItems: "center", justifyContent: "center" },
  detailHeaderRow: { flexDirection: "row", gap: 14, marginVertical: 12 },
  sosHeaderIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: `${colors.emergency}15`, alignItems: "center", justifyContent: "center" },
  detailHeaderTextWrap: { flex: 1 },
  detailHeaderTitle: { fontSize: 22, fontWeight: "700", color: colors.foreground },
  detailHeaderSub: { fontSize: 13, color: colors.mutedForeground, marginTop: 2 },
  sectionCard: { padding: 16, marginBottom: 14 },
  aiBullet: { fontSize: 13, color: colors.mutedForeground, marginTop: 4, lineHeight: 18 },
  sectionHeading: { fontSize: 13, fontWeight: "700", color: colors.mutedForeground, letterSpacing: 0.5, marginTop: 12, marginBottom: 8 },
});

