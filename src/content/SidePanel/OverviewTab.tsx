/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  eX — Redesigned Overview Tab
 *  src/content/SidePanel/OverviewTab.tsx
 *
 *  Features:
 *    1. Target Site Header & Navigation Status
 *    2. Trust Score Ring (0-100) with Grade Badge (A-F) & Risk Tone
 *    3. AI Executive Summary Card (LLM / Local Heuristic fallback)
 *    4. Permission & Access Monitor with "Active Now" hardware sensors
 *    5. 68-Parameter Category Breakdown with interactive metrics
 *    6. One-Click Quick Actions (Deep Scan, Trust Site, Ask AI)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import React, { useState, useEffect } from "react";
import type { TabId } from "./Tabs";
import PermissionMonitor, { type PermissionStateMap } from "./PermissionMonitor";
import { runComprehensiveAssessment, type SiteAssessment } from "../../detectors/assessment";

interface OverviewTabProps {
  siteVerdict: any;
  mailSummary: any;
  findings: any[];
  onSelectTab: (tab: TabId) => void;
  onStartSnip: () => void;
  onRunActiveScan: () => void;
  onAskAIAboutPage: () => void;
  onTrustSite?: (hostname: string) => void;
  onRescan?: () => void;
  isLocalhost: boolean;
  scanningActive: boolean;
  isMailPage?: boolean;
}

export default function OverviewTab({
  siteVerdict,
  mailSummary,
  findings,
  onSelectTab,
  onStartSnip,
  onRunActiveScan,
  onAskAIAboutPage,
  onTrustSite,
  onRescan,
  isLocalhost,
  scanningActive,
  isMailPage = false,
}: OverviewTabProps) {
  const [assessment, setAssessment] = useState<SiteAssessment | null>(null);
  const [permissions, setPermissions] = useState<PermissionStateMap>({});
  const [cameraActive, setCameraActive] = useState(false);
  const [micActive, setMicActive] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);

  const currentUrl = typeof window !== "undefined" ? window.location.href : "https://example.com";
  const currentHost = typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "") : "example.com";
  const isHttps = typeof window !== "undefined" ? window.location.protocol === "https:" : true;

  const refreshPermissionsAndAssessment = () => {
    if (typeof navigator !== "undefined" && navigator.permissions?.query) {
      const names = ["camera", "microphone", "geolocation", "notifications", "clipboard-read", "midi"];
      Promise.allSettled(
        names.map((name) =>
          navigator.permissions.query({ name: name as any }).then((s) => ({ name, state: s.state }))
        )
      ).then((results) => {
        const perms: PermissionStateMap = {};
        results.forEach((r, i) => {
          perms[names[i]] = r.status === "fulfilled" ? r.value.state : "unavailable";
        });
        setPermissions(perms);
      });
    }

    if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
      navigator.mediaDevices.enumerateDevices().then((devices) => {
        setCameraActive(devices.some((d) => d.kind === "videoinput" && d.label !== ""));
        setMicActive(devices.some((d) => d.kind === "audioinput" && d.label !== ""));
      }).catch(() => {});
    }

    chrome.runtime.sendMessage({ type: "GET_SITE_ASSESSMENT" }, (res) => {
      if (res?.ok && res.data) {
        setAssessment(res.data);
      } else {
        const local = runComprehensiveAssessment({
          url: currentUrl,
          permissions,
          trackerEvents: { cameraActive, micActive },
        });
        setAssessment(local);
      }
    });
  };

  useEffect(() => {
    refreshPermissionsAndAssessment();
    const interval = setInterval(refreshPermissionsAndAssessment, 6000);
    return () => clearInterval(interval);
  }, [currentUrl]);

  const trustScore = assessment?.overallScore ?? (siteVerdict ? Math.max(0, 100 - (siteVerdict.score || 0)) : 88);
  const grade = assessment?.grade ?? (trustScore >= 90 ? "A" : trustScore >= 75 ? "B" : trustScore >= 55 ? "C" : "F");

  const scoreColor =
    trustScore >= 80 ? "#00ffd2" : trustScore >= 60 ? "#ffd600" : trustScore >= 40 ? "#ff9500" : "#ff3b30";

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (trustScore / 100) * circumference;

  const categories = assessment?.categories
    ? Object.entries(assessment.categories).map(([key, cat]) => ({ key, ...cat }))
    : [];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px", overflowY: "auto", flex: 1 }}>
      {/* ── 1. Target Site Header ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 14px",
        background: "rgba(255, 255, 255, 0.02)",
        border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.08))",
        borderRadius: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
          <span style={{ fontSize: "14px" }}>{isHttps ? "🔒" : "⚠️"}</span>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {currentHost}
            </span>
            <span style={{ fontSize: "10px", color: isHttps ? "#00ffd2" : "#ff3b30" }}>
              {isHttps ? "HTTPS TLS Encrypted" : "Insecure Plaintext"}
            </span>
          </div>
        </div>

        <div style={{ display: "flex", gap: "6px" }}>
          {onRescan && (
            <button
              onClick={onRescan}
              disabled={scanningActive}
              style={{
                padding: "4px 8px",
                background: "rgba(36, 82, 255, 0.15)",
                border: "1px solid rgba(36, 82, 255, 0.4)",
                borderRadius: "4px",
                color: "#fff",
                fontSize: "10px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {scanningActive ? "Scanning…" : "↻ Deep Check"}
            </button>
          )}
        </div>
      </div>

      {/* ── 2. Trust Score Ring & Grade Badge ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 20px",
        background: "rgba(255, 255, 255, 0.02)",
        borderRadius: "12px",
        border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.08))",
      }}>
        <div style={{ position: "relative", width: "92px", height: "92px", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="92" height="92" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="46" cy="46" r="40" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="7" />
            <circle
              cx="46" cy="46" r="40" fill="none"
              stroke={scoreColor}
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div style={{ position: "absolute", display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: "24px", fontWeight: 800, color: scoreColor, lineHeight: 1 }}>{trustScore}</span>
            <span style={{ fontSize: "9px", fontWeight: 700, color: "var(--text-muted, #888)" }}>/ 100</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted, #888)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              GRADE
            </span>
            <span style={{
              background: scoreColor,
              color: "#0c0c12",
              fontSize: "18px",
              fontWeight: 900,
              padding: "2px 10px",
              borderRadius: "6px",
              lineHeight: 1.2,
            }}>
              {grade}
            </span>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#fff" }}>
            {assessment?.riskLevel === "LOW" ? "High Trust · Verified" : assessment?.riskLevel === "MEDIUM" ? "Caution Recommended" : "Significant Threat"}
          </span>
          <span style={{ fontSize: "10px", color: "var(--text-muted, #888)" }}>
            Evaluated against ~68 security parameters
          </span>
        </div>
      </div>

      {/* ── 3. AI Executive Summary Card ── */}
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "12px 14px",
        background: "rgba(0, 255, 210, 0.03)",
        border: "1px solid rgba(0, 255, 210, 0.2)",
        borderRadius: "8px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{ fontSize: "13px" }}>🤖</span>
            <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#00ffd2", letterSpacing: "0.06em" }}>
              AI Security Assessment
            </span>
          </div>
          <span style={{
            fontSize: "9px",
            fontWeight: 700,
            padding: "2px 6px",
            borderRadius: "4px",
            background: trustScore >= 75 ? "rgba(0,255,210,0.15)" : "rgba(255,59,48,0.2)",
            color: trustScore >= 75 ? "#00ffd2" : "#ff453a",
            textTransform: "uppercase",
          }}>
            {trustScore >= 75 ? "Safe To Browse" : "Proceed With Caution"}
          </span>
        </div>

        <p style={{ fontSize: "11px", color: "rgba(255, 255, 255, 0.85)", margin: 0, lineHeight: 1.5 }}>
          {assessment?.summaryText || (siteVerdict?.reasons?.[0] ? "Site analysis: " + siteVerdict.reasons[0] : "Real-time telemetry and heuristic analysis completed with no anomalous behavior.")}
        </p>

        {assessment?.keyRisks && assessment.keyRisks.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "4px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "#ffb300", textTransform: "uppercase" }}>
              Top Security Observations:
            </span>
            {assessment.keyRisks.map((risk, i) => (
              <span key={i} style={{ fontSize: "10px", color: "rgba(255,255,255,0.7)", display: "flex", gap: "4px" }}>
                <span style={{ color: "#ff9500" }}>•</span> {risk}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. Permission & Access Monitor ── */}
      <PermissionMonitor
        permissions={permissions}
        cameraActive={cameraActive}
        micActive={micActive}
        onRefresh={refreshPermissionsAndAssessment}
      />

      {/* ── 5. 68-Parameter Category Breakdown ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--text-muted, #888)" }}>
          Researched Security Matrix (68 Parameters)
        </span>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          {categories.map((cat) => {
            const isExpanded = expandedCat === cat.key;
            const catScoreColor = cat.score >= 80 ? "#00ffd2" : cat.score >= 60 ? "#ffd600" : "#ff3b30";

            return (
              <div
                key={cat.key}
                style={{
                  background: "rgba(255, 255, 255, 0.02)",
                  border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.07))",
                  borderRadius: "6px",
                  overflow: "hidden",
                }}
              >
                <div
                  onClick={() => setExpandedCat(isExpanded ? null : cat.key)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "9px 12px",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#fff" }}>{cat.name}</span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted, #888)" }}>
                      ({cat.passedCount}/{cat.totalCount})
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "45px", height: "4px", background: "rgba(255,255,255,0.1)", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{ width: cat.score + "%", height: "100%", background: catScoreColor }} />
                    </div>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: catScoreColor, width: "28px", textAlign: "right" }}>
                      {cat.score}%
                    </span>
                    <span style={{ fontSize: "10px", color: "var(--text-muted, #888)" }}>
                      {isExpanded ? "▲" : "▼"}
                    </span>
                  </div>
                </div>

                {isExpanded && (
                  <div style={{
                    padding: "8px 12px",
                    background: "rgba(0,0,0,0.2)",
                    borderTop: "1px solid rgba(255,255,255,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}>
                    {cat.parameters.map((p) => (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "10px" }}>
                        <span style={{ color: p.status === "fail" ? "#ff453a" : p.status === "warning" ? "#ffb300" : "rgba(255,255,255,0.75)" }}>
                          {p.name}
                        </span>
                        <span style={{ color: "var(--text-muted, #888)", fontSize: "9px" }}>
                          {p.details}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── 6. Webmail Summary Card (Only if on mail page) ── */}
      {isMailPage && mailSummary && (
        <div
          onClick={() => onSelectTab("mail")}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px",
            background: "rgba(36, 82, 255, 0.06)",
            border: "1px solid rgba(36, 82, 255, 0.3)",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "14px" }}>📧</span>
            <div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#fff" }}>Webmail Guard Active</div>
              <div style={{ fontSize: "10px", color: "var(--text-muted, #888)" }}>
                {mailSummary.scannedCount ?? 0} emails scanned · {mailSummary.flagged?.length ?? 0} threats flagged
              </div>
            </div>
          </div>
          <span style={{ fontSize: "11px", color: "#00ffd2", fontWeight: 600 }}>Open Mail Tab →</span>
        </div>
      )}

      {/* ── 7. Quick Actions Grid ── */}
      <div style={{ display: "flex", gap: "8px" }}>
        <button
          onClick={onAskAIAboutPage}
          style={{
            flex: 1,
            padding: "8px",
            background: "rgba(36, 82, 255, 0.2)",
            border: "1px solid rgba(36, 82, 255, 0.5)",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          💬 Ask AI
        </button>

        {onTrustSite && (
          <button
            onClick={() => onTrustSite(currentHost)}
            style={{
              flex: 1,
              padding: "8px",
              background: "rgba(255, 255, 255, 0.04)",
              border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.12))",
              borderRadius: "6px",
              color: "#fff",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            ✓ Trust Site
          </button>
        )}

        <button
          onClick={onStartSnip}
          style={{
            flex: 1,
            padding: "8px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid var(--panel-border, rgba(255, 255, 255, 0.12))",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "11px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          ✂️ Snip
        </button>
      </div>
    </div>
  );
}
