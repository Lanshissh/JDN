import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import axios from "axios";
import { useScanHistory } from "../../contexts/ScanHistoryContext";
import { useAuth } from "../../contexts/AuthContext";
import { useFocusEffect } from "expo-router";
import { BASE_API } from "../../constants/api";

// Some backends return DECIMAL columns as strings.
// Use a tolerant numeric type then coerce with toNum(...)
type Numeric = number | string | null;

type Computation = {
  meter_id: string;
  meter_type: "electric" | "water" | "lpg" | string;
  consumption_latest: Numeric;
  consumption_prev: Numeric;
  change_rate: Numeric; // percentage
  base_latest: Numeric;
  vat_latest: Numeric;
  bill_latest_total: Numeric;
  base_prev: Numeric;
  vat_prev: Numeric;
  bill_prev_total: Numeric;
  note?: string;
};

type RowState = Computation | { error: string } | undefined;

// ---- helpers (number coercion + formatting) ----
const toNum = (x: unknown): number | null => {
  if (x === null || x === undefined) return null;
  const n = typeof x === "number" ? x : Number(x);
  return Number.isFinite(n) ? n : null;
};

const fmtAmt = (x: unknown) => {
  const n = toNum(x);
  return n == null
    ? "—"
    : n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtPct = (x: unknown) => {
  const n = toNum(x);
  return n == null ? "—" : `${n.toFixed(1)}%`;
};

const arrow = (x: unknown) => {
  const n = toNum(x);
  return n == null ? "" : n > 0 ? "▲" : n < 0 ? "▼" : "•";
};

const colorForChange = (x: unknown) => {
  const n = toNum(x);
  return n == null ? "#6b7280" : n > 0 ? "#e53935" : n < 0 ? "#2e7d32" : "#6b7280";
};

const unitFor = (t?: string) => {
  const k = (t || "").toLowerCase();
  if (k === "electric") return "kWh";
  if (k === "water") return "m³";
  if (k === "lpg") return "kg";
  return "";
};

export default function HistoryScreen() {
  const { scans, clearScans } = useScanHistory();
  const { token } = useAuth();

  /**
   * Extract original meter IDs from scans.
   * - Prefer explicit MTR-... token (keep ORIGINAL case)
   * - Else accept a clean non-URL token (A–Z/0–9/-, len>=3)
   * - De-dupe case-insensitively but store first-seen original form
   */
  const { meterIds } = useMemo(() => {
    const normToOrig = new Map<string, string>();
    for (const s of scans) {
      const raw = String(s.data || "").trim();
      const mtr = raw.match(/\bMTR-[A-Za-z0-9-]+\b/);
      let candidate = mtr ? mtr[0] : raw.replace(/[\r\n]/g, "");

      // ignore URLs
      if (/^https?:\/\//i.test(candidate)) continue;
      // require a clean token
      if (!/^[A-Za-z0-9-]{3,}$/.test(candidate)) continue;

      const norm = candidate.toLowerCase();
      if (!normToOrig.has(norm)) normToOrig.set(norm, candidate);
    }
    return { meterIds: Array.from(normToOrig.values()) };
  }, [scans]);

  const [loading, setLoading] = useState(false);
  // store rows keyed by normalized id
  const [items, setItems] = useState<Record<string, RowState>>({});

  const api = useMemo(
    () =>
      axios.create({
        baseURL: BASE_API,
        headers: { Authorization: `Bearer ${token ?? ""}` },
        timeout: 15000,
      }),
    [token]
  );

  const loadAll = async () => {
    if (!meterIds.length) {
      setItems({});
      return;
    }
    try {
      setLoading(true);
      const results = await Promise.all(
        meterIds.map(async (originalId) => {
          const norm = originalId.toLowerCase();
          try {
            // Pass ORIGINAL id to match DB exactly (no forced upper/lower)
            const res = await api.get<Computation>(
              `/meters/${encodeURIComponent(originalId)}/computation`
            );
            return [norm, res.data] as const;
          } catch (err: any) {
            const msg =
              err?.response?.data?.error ||
              err?.response?.data?.message ||
              err?.message ||
              "Failed to fetch";
            return [norm, { error: msg }] as const;
          }
        })
      );
      const map: Record<string, RowState> = {};
      results.forEach(([norm, data]) => (map[norm] = data));
      setItems(map);
    } finally {
      setLoading(false);
    }
  };

  // Refresh when token changes, meter list changes, OR when a new scan arrives (even duplicate id)
  const lastScanTick = scans[0]?.timestamp ?? "";
  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, meterIds.join("|"), lastScanTick]);

  // Also refetch whenever the History tab gains focus
  useFocusEffect(
    React.useCallback(() => {
      loadAll();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [meterIds.join("|")])
  );

  // Type guard
  const isComputation = (v: RowState): v is Computation => !!v && !("error" in v);

  // Keep row order aligned with meterIds
  const rows: Array<{ idOrig: string; row: RowState }> = useMemo(
    () => meterIds.map((idOrig) => ({ idOrig, row: items[idOrig.toLowerCase()] })),
    [meterIds, items]
  );

  // Dashboard aggregates (server is source of truth — we only format/sum safely)
  const computedRows = rows.map((r) => r.row).filter(isComputation);

  const totals = useMemo(() => {
    const changeVals = computedRows
      .map((r) => toNum(r.change_rate))
      .filter((v): v is number => v !== null);

    const bill_latest_total = computedRows
      .map((r) => toNum(r.bill_latest_total) ?? 0)
      .reduce((a, b) => a + b, 0);

    const avgChange = changeVals.length
      ? changeVals.reduce((a, b) => a + b, 0) / changeVals.length
      : null;

    const up = changeVals.filter((v) => v > 0).length;
    const down = changeVals.filter((v) => v < 0).length;

    return {
      meters: meterIds.length,
      fetched: computedRows.length,
      avgChange,
      totalLatestBill: bill_latest_total,
      up,
      down,
    };
  }, [computedRows, meterIds.length]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Billing Dashboard</Text>
      </View>

      {/* Summary cards */}
      <View style={styles.grid}>
        <StatCard label="Meters scanned" value={String(totals.meters)} />
        <StatCard label="With data" value={String(totals.fetched)} />
        <StatCard label="Avg change" value={fmtPct(totals.avgChange)} />
        <StatCard label="Total latest bill" value={`₱ ${fmtAmt(totals.totalLatestBill)}`} />
      </View>

      {/* Change quick glance */}
      <View style={[styles.rowCard, { marginTop: 10 }]}>
        <Text style={styles.rowText}>
          ▲ Up: <Text style={{ color: "#e53935", fontWeight: "700" }}>{totals.up}</Text>
          {"  "}•{"  "}
          ▼ Down: <Text style={{ color: "#2e7d32", fontWeight: "700" }}>{totals.down}</Text>
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadAll} disabled={loading}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.refreshText}>Refresh</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[styles.refreshBtn, styles.clearBtn]} onPress={clearScans}>
          <Text style={styles.refreshText}>Clear history</Text>
        </TouchableOpacity>
      </View>

      {/* Empty state or list */}
      {!meterIds.length ? (
        <Text style={styles.noHistory}>Scan a meter QR to see its billing computation.</Text>
      ) : (
        <FlatList
          style={{ marginTop: 6 }}
          data={rows}
          keyExtractor={(r) => r.idOrig}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadAll} />}
          renderItem={({ item }) => {
            const { idOrig, row } = item;

            if (!row) {
              return (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{idOrig}</Text>
                  <Text style={styles.cardSub}>Loading…</Text>
                </View>
              );
            }

            if ("error" in row) {
              return (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>{idOrig}</Text>
                  <Text style={[styles.cardSub, { color: "#e53935" }]}>{row.error}</Text>
                </View>
              );
            }

            const r = row;
            const unit = unitFor(r.meter_type);

            return (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>
                  {idOrig} • {r.meter_type?.toUpperCase?.() || "METER"}
                </Text>
                {/* server-confirmed id (handy if QR contained extra text) */}
                <Text style={styles.kvMuted}>Server meter: {r.meter_id || "—"}</Text>

                {r.note ? (
                  <Text style={styles.cardSub}>{r.note}</Text>
                ) : (
                  <>
                    <View style={styles.split}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.kvLabel}>Consumption</Text>
                        <Text style={styles.kvValue}>
                          {fmtAmt(r.consumption_latest)}
                          {unit ? ` ${unit}` : ""}{" "}
                          <Text style={styles.kvMuted}>
                            (prev {fmtAmt(r.consumption_prev)}
                            {unit ? ` ${unit}` : ""})
                          </Text>
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={styles.kvLabel}>Change</Text>
                        <Text style={[styles.kvValue, { color: colorForChange(r.change_rate) }]}>
                          {arrow(r.change_rate)} {fmtPct(r.change_rate)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.divider} />

                    <View style={styles.split}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.kvLabel}>Base</Text>
                        <Text style={styles.kvValue}>₱ {fmtAmt(r.base_latest)}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: "center" }}>
                        <Text style={styles.kvLabel}>VAT</Text>
                        <Text style={styles.kvValue}>₱ {fmtAmt(r.vat_latest)}</Text>
                      </View>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text style={styles.kvLabel}>Total</Text>
                        <Text style={styles.kvValue}>₱ {fmtAmt(r.bill_latest_total)}</Text>
                      </View>
                    </View>

                    {toNum(r.base_prev) !== null && (
                      <>
                        <Text style={[styles.kvLabel, { marginTop: 8 }]}>Previous bill</Text>
                        <Text style={styles.kvMuted}>
                          Base ₱ {fmtAmt(r.base_prev)} • VAT ₱ {fmtAmt(r.vat_prev)} • Total ₱{" "}
                          {fmtAmt(r.bill_prev_total)}
                        </Text>
                      </>
                    )}
                  </>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: "#f9f9f9" },
header: {
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: 12,
},
  logo: {
  height: 30, 
  width: 110, 
  marginTop: 25,
},
  title: {
    textAlign: "center",
},
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    flexGrow: 1,
    minWidth: 150,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  statLabel: { fontSize: 12, color: "#6b7280", marginBottom: 4, textTransform: "uppercase" },
  statValue: { fontSize: 18, fontWeight: "800", color: "#102a43" },

  rowCard: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 12,
    marginTop: 6,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  rowText: { color: "#102a43" },

  actions: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 8 },
  refreshBtn: {
    backgroundColor: "#1f4bd8",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  clearBtn: { backgroundColor: "#6b7280" },
  refreshText: { color: "#fff", fontWeight: "700" },

  noHistory: { fontSize: 16, color: "#888", textAlign: "center", marginTop: 24 },

  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  cardTitle: { fontSize: 16, fontWeight: "800", color: "#102a43" },
  cardSub: { color: "#6b7280", marginTop: 4 },

  split: { marginTop: 10, flexDirection: "row", alignItems: "flex-end" },
  divider: { height: 1, backgroundColor: "#eef2f7", marginTop: 10 },

  kvLabel: { fontSize: 12, color: "#6b7280" },
  kvValue: { fontSize: 16, fontWeight: "700", color: "#102a43" },
  kvMuted: { color: "#6b7280" },
});