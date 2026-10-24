// ─── Shared Types — single source of truth ───────────────────────────────────

export type FocusCategory = "Study" | "Coding" | "Research" | "Reading" | "Writing" | "Custom";
export type FocusStatus = "active" | "paused" | "completed" | "cancelled";
export type RiskLevel = "Safe" | "Medium Risk" | "High Risk";
export type ProductivityPeriod = "daily" | "weekly" | "monthly";
export type TaskState = "pending" | "in_progress" | "completed" | "overdue";
export type TaskPriority = "low" | "medium" | "high";

export interface FocusSession {
  id: string;
  goal: string;
  category: FocusCategory;
  durationMinutes: number;
  startedAt: number;
  endedAt: number | null;
  status: FocusStatus;
  distractionAttempts: number;
}

export interface TabRecord {
  tabId: number;
  url: string;
  domain: string;
  title: string;
  openedAt: number;
  lastAccessedAt: number;
  activeDurationMs: number;
  visitCount: number;
  category: string;
  description?: string;
  ogType?: string;
  cameraAccessCount?: number;
  micAccessCount?: number;
  fetchCount?: number;
}

export interface SecurityReport {
  origin: string;
  generatedAt: number;

  // Connection
  https: boolean;
  certValid: boolean;
  certIssuer: string | null;
  certExpiresAt: number | null;

  // IP + Hosting
  ip: string | null;
  isp: string | null;
  org: string | null;             // hosting company — display as HOSTING
  asn: string | null;
  country: string | null;
  region: string | null;
  city: string | null;

  // Domain intel
  domain: string;
  ageDays: number | null;
  ageYears: string | null;        // "7.9 years"
  registeredAt: string | null;    // ISO date
  expiresAt: string | null;
  registrar: string | null;
  nameservers: string[];

  // Heuristics
  flags: string[];

  // Permissions (filled by content script)
  permissions: Record<string, 'granted' | 'denied' | 'prompt' | 'unavailable'>;
  cameraActive: boolean;
  micActive: boolean;

  // Score
  safetyIndex: number;
  verdict: 'Safe' | 'Medium Risk' | 'High Risk';
  
  // NEW: Advanced cybersecurity intelligence modules
  historyTimeline: HistoryEvent[];
  fingerprint: WebsiteFingerprint;

  // Legacy support compatibility
  riskLevel?: RiskLevel;
  resolvedIp?: string;
  hostingLocation?: string;
}

export interface HistoryEvent {
  timestamp: string; // e.g. "Dec 2022" or ISO string
  type: string;      // e.g. "Domain Registered", "Certificate Renewed"
  description: string;
  confidence: 'Low' | 'Medium' | 'High';
  classification: 'Green' | 'Yellow' | 'Red';
}

export interface WebsiteFingerprint {
  category: string;
  trustLevel: 'Very High' | 'High' | 'Medium' | 'Low' | 'Critical';
  securityScore: number;
  privacyScore: number;
  domainMaturity: 'New' | 'Growing' | 'Established' | 'Mature' | 'Legacy';
  popularity: 'High' | 'Medium' | 'Low';
  trafficConfidence: 'High' | 'Medium' | 'Low';
  riskLevel: 'Safe' | 'Low Risk' | 'Medium Risk' | 'High Risk' | 'Dangerous';
  primaryRegion: string;
  hostingType: string;
  techStack: string[];
}

export interface TabEntry {
  domain: string;
  url: string;
  title: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  category: string;
  date: string; // YYYY-MM-DD
}

export interface WeeklyTabAnalysis {
  generatedAt: number;
  totalDomains: number;
  totalSessionTime: string;
  topDomains: {
    domain: string;
    visits: number;
    durationMs: number;
    durationFormatted: string;
    category: string;
  }[];
  categoryBreakdown: {
    category: string;
    durationMs: number;
    durationFormatted: string;
    percentage: number;
  }[];
  dailyActivity: Record<string, number>;
  mostProductiveDay: string | null;
  productiveMs: number;
  distractingMs: number;
  productiveFormatted: string;
  distractingFormatted: string;
}

export interface ProductivityFactor {
  label: string;
  contribution: number;
}

export interface ProductivityRollup {
  period: ProductivityPeriod;
  score: number;
  positiveFactors: ProductivityFactor[];
  negativeFactors: ProductivityFactor[];
  productiveMs: number;
  neutralMs: number;
  distractingMs: number;
  computedAt: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  category: string;
  createdAt: number;
  dueAt: number | null;
  priority: TaskPriority;
  status: TaskState;
}

export interface TabSnapshot {
  tabs: TabRecord[];
  duplicates: { url: string; tabIds: number[] }[];
  totalTabs: number;
  byCategory: Record<string, number>;
  topDomains: { domain: string; visitCount: number; activeDurationMs: number }[];
  snapshotAt: number;
}

// ─── AI Tool / Dock config types ─────────────────────────────────────────────

export interface AITool {
  id: string;
  name: string;
  url: string;
  icon: string; // SVG string
  pinned: boolean;
  order: number;
}

export interface DockItem {
  id: string;
  name: string;
  url: string;
  icon: string;
  order: number;
}

export type ClockStyle = "analog" | "digital";
export type ClockMode = "12h" | "24h";
export type AnimationSpeed = "fast" | "normal" | "slow";
export type ThemeId = "platinum" | "sapphire" | "crimson" | "gold" | "emerald" | "violet" | "neon-tokyo" | "solar-flare" | "obsidian" | "rose-gold";

export interface AppSettings {
  theme: ThemeId;
  clockStyle: ClockStyle;
  clockMode: ClockMode;
  blurAmount: number;
  animationSpeed: AnimationSpeed;
  edgeActivation: boolean;
  shortcut: string;
  focusBlocklist: string[];
  searchEngine: string;
}

export interface ExtensionState {
  aiTools: AITool[];
  dockItems: DockItem[];
  settings: AppSettings;
  focusSessions: FocusSession[];
  currentSession: FocusSession | null;
  tasks: Task[];
}
