// components/admin/MeterReadingPanel.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  Keyboard,
  Dimensions,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";

import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import {
  QRCodeScanner,
  OnSuccessfulScanProps,
} from "@masumdev/rn-qrcode-scanner";
import { BASE_API } from "../../constants/api";

/** Types **/
type Reading = {
  reading_id: string;
  meter_id: string;
  reading_value: number;
  read_by: string;
  lastread_date: string; // YYYY-MM-DD
  last_updated: string; // ISO
  updated_by: string;
};

type Meter = {
  meter_id: string;
  meter_type: "electric" | "water" | "lpg";
  meter_sn: string;
  meter_mult: number;
  stall_id: string;
  meter_status: "active" | "inactive";
  last_updated: string;
  updated_by: string;
};

export default function MeterReadingPanel({ token }: { token: string | null }) {
  /** Common **/
  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token ?? ""}` }),
    [token]
  );
  const api = useMemo(
    () =>
      axios.create({
        baseURL: BASE_API,
        headers: authHeader,
        timeout: 15000,
      }),
    [authHeader]
  );

  /** Data **/
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [query, setQuery] = useState("");

  /** Create form **/
  const [formMeterId, setFormMeterId] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDate, setFormDate] = useState<string>(today());

  /** Edit modal **/
  const [editVisible, setEditVisible] = useState(false);
  const [editRow, setEditRow] = useState<Reading | null>(null);
  const [editMeterId, setEditMeterId] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");

  /** Scan modal **/
  const [scanVisible, setScanVisible] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const readingInputRef = useRef<TextInput>(null);

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadAll = async () => {
    if (!token) {
      setBusy(false);
      Alert.alert("Not logged in", "Please log in to manage meter readings.");
      return;
    }
    try {
      setBusy(true);
      const [rRes, mRes] = await Promise.all([
        api.get<Reading[]>("/readings"),
        api.get<Meter[]>("/meters"),
      ]);
      // Sort newest first by lastread_date then id
      const sorted = [...rRes.data].sort((a, b) => {
        const ad = a.lastread_date.localeCompare(b.lastread_date);
        if (ad !== 0) return -ad; // desc
        return b.reading_id.localeCompare(a.reading_id);
      });
      setReadings(sorted);
      setMeters(mRes.data);
      if (!formMeterId && mRes.data.length) setFormMeterId(mRes.data[0].meter_id);
    } catch (err: any) {
      console.error("[READINGS LOAD]", err?.response?.data || err?.message);
      Alert.alert(
        "Load failed",
        err?.response?.data?.error ?? "Please check your connection and permissions."
      );
    } finally {
      setBusy(false);
    }
  };

  /** Helpers **/
  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return readings;
    return readings.filter((r) =>
      r.reading_id.toLowerCase().includes(q) ||
      r.meter_id.toLowerCase().includes(q) ||
      r.lastread_date.toLowerCase().includes(q) ||
      String(r.reading_value).toLowerCase().includes(q)
    );
  }, [readings, query]);

  const metersById = useMemo(() => {
    const map = new Map<string, Meter>();
    meters.forEach((m) => map.set(m.meter_id, m));
    return map;
  }, [meters]);

  /** Create **/
  const onCreate = async () => {
    if (!formMeterId || !formValue) {
      Alert.alert("Missing info", "Please select a meter and enter a reading.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/readings", {
        meter_id: formMeterId,
        reading_value: parseFloat(formValue),
        lastread_date: formDate || today(),
      });
      setFormValue("");
      setFormDate(today());
      await loadAll();
      Alert.alert("Success", "Meter reading recorded.");
    } catch (err: any) {
      console.error("[CREATE READING]", err?.response?.data || err?.message);
      Alert.alert(
        "Create failed",
        err?.response?.data?.error ?? "Server error."
      );
    } finally {
      setSubmitting(false);
    }
  };

  /** Edit **/
  const openEdit = (row: Reading) => {
    setEditRow(row);
    setEditMeterId(row.meter_id);
    setEditValue(String(row.reading_value));
    setEditDate(row.lastread_date);
    setEditVisible(true);
  };

  const onUpdate = async () => {
    if (!editRow) return;
    try {
      setSubmitting(true);
      await api.put(`/readings/${encodeURIComponent(editRow.reading_id)}`, {
        meter_id: editMeterId,
        reading_value: editValue === "" ? undefined : parseFloat(editValue),
        lastread_date: editDate,
      });
      setEditVisible(false);
      await loadAll();
      Alert.alert("Updated", "Reading updated successfully.");
    } catch (err: any) {
      console.error("[UPDATE READING]", err?.response?.data || err?.message);
      Alert.alert("Update failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Scan → Quick-edit **/
  const onScan = (data: OnSuccessfulScanProps | string) => {
    // Accept both object and string payloads from the scanner
    const rawScanned = String(
      (data as any)?.code ??
      (data as any)?.rawData ??
      (data as any)?.data ??
      data ??
      ''
    ).trim();

    if (!rawScanned) return;

    // Only accept meter codes like MTR-<...>
    const meterIdPattern = /^MTR-[A-Za-z0-9-]+$/i;
    if (!meterIdPattern.test(rawScanned)) {
      // Ignore non-meter QR data and keep scanning
      return;
    }
    const meterId = rawScanned;

    setScanVisible(false);

    // 1) If we already have readings for this meter → open latest in edit
    const latest = readings
      .filter((r) => r.meter_id === meterId)
      .sort((a, b) => {
        const ad = a.lastread_date.localeCompare(b.lastread_date);
        if (ad !== 0) return -ad;
        return b.reading_id.localeCompare(a.reading_id);
      })[0];

    if (latest) {
      openEdit(latest);
      return;
    }

    // 2) Otherwise, pre-fill the create form and focus reading input
    if (!metersById.get(meterId)) {
      Alert.alert("Unknown meter", `No meter found for id: ${meterId}`);
      return;
    }
    setFormMeterId(meterId);
    setTimeout(() => {
      readingInputRef.current?.focus?.();
    }, 150);
  };

  const openScanner = () => {
    setScannerKey((k) => k + 1); // refresh camera on open
    setScanVisible(true);
    Keyboard.dismiss();
  };

  /** Render **/
  return (
    <View style={styles.grid}>
      {/* Create Reading */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Record Meter Reading</Text>

        <View style={styles.rowWrap}>
          <Dropdown
            label="Meter"
            value={formMeterId}
            onChange={setFormMeterId}
            options={meters.map((m) => ({
              label: `${m.meter_id} • ${m.meter_type} • ${m.meter_sn}`,
              value: m.meter_id,
            }))}
          />

          <TouchableOpacity style={styles.scanBtn} onPress={openScanner}>
            <Text style={styles.scanBtnText}>Scan QR to select</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rowWrap}>
            <View style={{ flex: 1, marginTop: 8 }}>
            <Text style={styles.dropdownLabel}>Reading Value</Text>
            <TextInput
              ref={readingInputRef}
              style={styles.input}
              keyboardType="numeric"
              value={formValue}
              onChangeText={setFormValue}
              placeholder="Reading value"
            />
          </View>
          <DatePickerField label="Date read" value={formDate} onChange={setFormDate} />
        </View>

        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={onCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Save Reading</Text>
          )}
        </TouchableOpacity>

        <Text style={styles.hint}>New entries default the date to today.</Text>
      </View>

      {/* Manage Meter Readings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manage Meter Readings</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by Reading ID, Meter ID, date, value…"
          value={query}
          onChangeText={setQuery}
        />

        {busy ? (
          <View style={styles.loader}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.reading_id}
            ListEmptyComponent={<Text style={styles.empty}>No readings found.</Text>}
            renderItem={({ item }) => (
              <View style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {item.reading_id} • {item.meter_id}
                  </Text>
                  <Text style={styles.rowSub}>
                    {item.lastread_date} • Value: {item.reading_value}
                  </Text>
                  <Text style={styles.rowSub}>
                    Updated {formatDateTime(item.last_updated)} by {item.updated_by}
                  </Text>
                </View>
                <TouchableOpacity style={styles.link} onPress={() => openEdit(item)}>
                  <Text style={styles.linkText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

{/* Edit Modal */}
<Modal
  visible={editVisible}
  animationType="slide"
  transparent
  onRequestClose={() => setEditVisible(false)}
>
  <KeyboardAvoidingView
    behavior={Platform.OS === "ios" ? "padding" : undefined}
    style={styles.modalWrap}
  >
    {/* On mobile, cap height so content can scroll */}
    <View
      style={[
        styles.modalCard,
        Platform.OS !== "web" && {
          maxHeight: Math.round(Dimensions.get("window").height * 0.85),
        },
      ]}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: 12 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.modalTitle}>Edit {editRow?.reading_id}</Text>

        {/* Meter (now guaranteed visible on mobile due to scroll) */}
        <Dropdown
          label="Meter"
          value={editMeterId}
          onChange={setEditMeterId}
          options={meters.map((m) => ({
            label: `${m.meter_id} • ${m.meter_type} • ${m.meter_sn}`,
            value: m.meter_id,
          }))}
        />

        {/* Equal-width inputs with labels */}
        <View style={styles.rowWrap}>
          <View style={{ flex: 1, marginTop: 8 }}>
            <Text style={styles.dropdownLabel}>Reading Value</Text>
            <TextInput
              style={styles.input}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
              placeholder="Reading value"
            />
          </View>

          <DatePickerField
            label="Date read"
            value={editDate}
            onChange={setEditDate}
          />
        </View>

        <View style={styles.modalActions}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGhost]}
            onPress={() => setEditVisible(false)}
          >
            <Text style={styles.btnGhostText || [styles.btnText, { color: "#102a43" }]}>
              Cancel
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={onUpdate}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Save changes</Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  </KeyboardAvoidingView>
</Modal>


      {/* Scanner Modal */}
      <Modal
        visible={scanVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setScanVisible(false)}
      >
        <View style={styles.scanOverlay}>
          <View style={styles.scanCard}>
            {Platform.OS === "web" ? (
              <Text style={styles.scanInfo}>
                Camera access requires HTTPS in the browser. If the camera does not start, please use the dropdown instead.
              </Text>
            ) : null}

            <View style={styles.scannerBox}>
              <QRCodeScanner
                key={scannerKey}
                core={{ onSuccessfulScan: onScan }}
                scanning={{ cooldownDuration: 1200 }}
                uiControls={{ showControls: true, showTorchButton: true, showStatus: true }}
              />
            </View>

            <Text style={styles.scanHint}>
              Point your camera at a meter QR code to quick‑edit its latest reading or pre‑fill the form.
            </Text>

            <TouchableOpacity
              style={[styles.btn, { marginTop: 12 }]}
              onPress={() => setScanVisible(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** Small UI bits reused across panels **/
function Dropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <View style={{ marginTop: 8, flex: 1 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={value} onValueChange={(itemValue) => onChange(String(itemValue))} style={styles.picker}>
          {options.map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function formatDateTime(dt: string) {
  const d = new Date(dt);
  if (isNaN(d.getTime())) return dt || "";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Date utilities & pickers (works on web and mobile) ---
function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function parseYMD(ymd: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(ymd || "");
  if (!m) {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function DatePickerField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void; }) {
  const [visible, setVisible] = React.useState(false);
  const display = value || new Date().toISOString().slice(0, 10);
  return (
    <View style={{ flex: 1, marginTop: 8 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity style={[styles.input, styles.dateButton]} onPress={() => setVisible(true)}>
        <Text style={styles.dateButtonText}>{display}</Text>
      </TouchableOpacity>
      <DatePickerModal
        visible={visible}
        initialDate={display}
        onClose={() => setVisible(false)}
        onConfirm={(d) => { onChange(d); setVisible(false); }}
      />
    </View>
  );
}

function DatePickerModal({ visible, initialDate, onClose, onConfirm }: { visible: boolean; initialDate: string; onClose: () => void; onConfirm: (value: string) => void; }) {
  const now = new Date();
  const init = parseYMD(initialDate);
  const [y, setY] = React.useState(init.y);
  const [m, setM] = React.useState(init.m);
  const [d, setD] = React.useState(init.d);

  // keep day in range when month/year changes
  React.useEffect(() => {
    const max = daysInMonth(y, m);
    if (d > max) setD(max);
  }, [y, m]);

  const years = React.useMemo(() => {
    const cy = now.getFullYear();
    const start = cy - 10; // adjust range if you want more history
    const end = cy + 5;
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, []);

  const months = React.useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = React.useMemo(() => Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1), [y, m]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalWrap}>
        <View style={styles.dateModalCard}>
          <Text style={styles.modalTitle}>Select date</Text>
          <View style={styles.datePickersRow}>
            <View style={styles.datePickerCol}>
              <Text style={styles.dropdownLabel}>Year</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={y} onValueChange={(val) => setY(Number(val))} style={styles.picker}>
                  {years.map((yy) => <Picker.Item key={yy} label={String(yy)} value={yy} />)}
                </Picker>
              </View>
            </View>
            <View style={styles.datePickerCol}>
              <Text style={styles.dropdownLabel}>Month</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={m} onValueChange={(val) => setM(Number(val))} style={styles.picker}>
                  {months.map((mm) => <Picker.Item key={mm} label={pad(mm)} value={mm} />)}
                </Picker>
              </View>
            </View>
            <View style={styles.datePickerCol}>
              <Text style={styles.dropdownLabel}>Day</Text>
              <View style={styles.pickerWrapper}>
                <Picker selectedValue={d} onValueChange={(val) => setD(Number(val))} style={styles.picker}>
                  {days.map((dd) => <Picker.Item key={dd} label={pad(dd)} value={dd} />)}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onClose}>
              <Text style={[styles.btnText, { color: "#102a43" }]}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => onConfirm(`${y}-${pad(m)}-${pad(d)}`)}
            >
              <Text style={styles.btnText}>Set date</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Styles – mirrors your existing admin panel look **/
const styles = StyleSheet.create({
  grid: { gap: 16 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: "0 10px 30px rgba(0,0,0,0.15)" as any },
      default: { elevation: 3 },
    }),
  },
  cardTitle: { fontSize: 18, fontWeight: "700", color: "#102a43", marginBottom: 12 },

  rowWrap: { flexDirection: "row", gap: 12, alignItems: "center", flexWrap: "wrap" },
  input: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: "#102a43",
    marginTop: 6,
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#1f4bd8",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700" },
  hint: { marginTop: 8, color: "#627d98" },

  /* Manage list */
  search: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },
  loader: { paddingVertical: 20, alignItems: "center" },
  empty: { textAlign: "center", color: "#627d98", paddingVertical: 16 },
  listRow: {
    borderWidth: 1,
    borderColor: "#edf2f7",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
    ...Platform.select({
      web: { boxShadow: "0 2px 8px rgba(0,0,0,0.06)" as any },
      default: { elevation: 1 },
    }),
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rowTitle: { fontWeight: "700", color: "#102a43" },
  rowSub: { color: "#627d98" },
  link: { paddingVertical: 8, paddingHorizontal: 10 },
  linkText: { color: "#1f4bd8", fontWeight: "700" },

  /* Modal */
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#102a43", marginBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },

  /* Scanner */
  scanOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "center",
    padding: 0,
  },
  scanCard: {
    backgroundColor: "#111827",
    borderRadius: 0,
    paddingTop: 0,
    paddingHorizontal: 12,
    paddingBottom: 12,
    width: "100%",
    height: "100%",
    flex: 1,
  },
  scanInfo: { color: "#e5e7eb", textAlign: "center", marginBottom: 8 },
  scannerBox: { flex: 1, width: "100%", alignSelf: "stretch" },
  scanHint: { color: "#e5e7eb", textAlign: "center", marginTop: 10 },

  /* Dropdown */
  dropdownLabel: { color: "#334e68", marginBottom: 6, marginTop: 6, fontWeight: "600" },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  picker: { height: 50 },

  /* Date picker modal */
  dateButton: { minWidth: 160, justifyContent: "center" },
  dateButtonText: { color: "#102a43" },
  dateModalCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    width: "100%",
    maxWidth: 520,
  },
  datePickersRow: { flexDirection: "row", gap: 12 },
  datePickerCol: { flex: 1 },

  scanBtn: {
    marginTop: 14,
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  scanBtnText: { color: "#fff", fontWeight: "700" },

  btnGhost: {
  backgroundColor: "transparent",
  borderWidth: 1,
  borderColor: "#cbd5e1", // subtle gray border
},
btnGhostText: {
  color: "#102a43",       // readable dark blue
  fontWeight: "700",
},
});