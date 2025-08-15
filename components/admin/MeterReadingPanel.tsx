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
  SafeAreaView,
} from "react-native";

import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import {
  QRCodeScanner,
  OnSuccessfulScanProps,
} from "@masumdev/rn-qrcode-scanner";
import { BASE_API } from "../../constants/api";

type Reading = {
  reading_id: string;
  meter_id: string;
  reading_value: number;
  read_by: string;
  lastread_date: string;
  last_updated: string;
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
  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token ?? ""}` }),
    [token],
  );
  const api = useMemo(
    () =>
      axios.create({
        baseURL: BASE_API,
        headers: authHeader,
        timeout: 15000,
      }),
    [authHeader],
  );

  const [typeFilter, setTypeFilter] = useState<
    "" | "electric" | "water" | "lpg"
  >("");

  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [query, setQuery] = useState("");

  const [formMeterId, setFormMeterId] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formDate, setFormDate] = useState<string>(today());

  const [editVisible, setEditVisible] = useState(false);
  const [editRow, setEditRow] = useState<Reading | null>(null);
  const [editMeterId, setEditMeterId] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editDate, setEditDate] = useState("");

  const [scanVisible, setScanVisible] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);
  const readingInputRef = useRef<TextInput>(null);

  const [sortBy, setSortBy] = useState<
    "date_desc" | "date_asc" | "id_desc" | "id_asc"
  >("date_desc");

  const readNum = (id: string) => {
    const m = /^MR-(\d+)/i.exec(id || "");
    return m ? parseInt(m[1], 10) : 0;
  };

  useEffect(() => {
    loadAll();
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

      setReadings(rRes.data);
      setMeters(mRes.data);
      if (!formMeterId && mRes.data.length)
        setFormMeterId(mRes.data[0].meter_id);
    } catch (err: any) {
      console.error("[READINGS LOAD]", err?.response?.data || err?.message);
      Alert.alert(
        "Load failed",
        err?.response?.data?.error ??
          "Please check your connection and permissions.",
      );
    } finally {
      setBusy(false);
    }
  };

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  const metersById = useMemo(() => {
    const map = new Map<string, Meter>();
    meters.forEach((m) => map.set(m.meter_id, m));
    return map;
  }, [meters]);

  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return readings;
    return readings.filter(
      (r) =>
        r.reading_id.toLowerCase().includes(q) ||
        r.meter_id.toLowerCase().includes(q) ||
        r.lastread_date.toLowerCase().includes(q) ||
        String(r.reading_value).toLowerCase().includes(q),
    );
  }, [readings, query]);

  const visible = useMemo(() => {
    const typed = searched.filter(
      (r) =>
        !typeFilter ||
        (metersById.get(r.meter_id)?.meter_type || "").toLowerCase() ===
          typeFilter,
    );

    const arr = [...typed];
    switch (sortBy) {
      case "date_asc":
        arr.sort(
          (a, b) =>
            a.lastread_date.localeCompare(b.lastread_date) ||
            readNum(a.reading_id) - readNum(b.reading_id),
        );
        break;
      case "id_asc":
        arr.sort((a, b) => readNum(a.reading_id) - readNum(b.reading_id));
        break;
      case "id_desc":
        arr.sort((a, b) => readNum(b.reading_id) - readNum(a.reading_id));
        break;
      case "date_desc":
      default:
        arr.sort(
          (a, b) =>
            b.lastread_date.localeCompare(a.lastread_date) ||
            readNum(b.reading_id) - readNum(a.reading_id),
        );
    }
    return arr;
  }, [searched, typeFilter, metersById, sortBy]);

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
        err?.response?.data?.error ?? "Server error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = (row?: Reading) => {
    const target = row ?? editRow;
    if (!target) return;

    const performDelete = async () => {
      try {
        setSubmitting(true);
        await api.delete(`/readings/${encodeURIComponent(target.reading_id)}`);
        setEditVisible(false);
        await loadAll();
        Alert.alert("Deleted", "Reading removed.");
      } catch (err: any) {
        console.error("[DELETE READING]", err?.response?.data || err?.message);
        Alert.alert(
          "Delete failed",
          err?.response?.data?.error ?? "Server error.",
        );
      } finally {
        setSubmitting(false);
      }
    };

    if (
      Platform.OS === "web" &&
      typeof (globalThis as any).confirm === "function"
    ) {
      const ok = (globalThis as any).confirm(
        `Delete reading ${target.reading_id}? This cannot be undone.`,
      );
      if (ok) performDelete();
      return;
    }

    Alert.alert(
      "Delete reading?",
      `Are you sure you want to delete ${target.reading_id}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: performDelete },
      ],
    );
  };

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
      Alert.alert(
        "Update failed",
        err?.response?.data?.error ?? "Server error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onScan = (data: OnSuccessfulScanProps | string) => {
    const rawScanned = String(
      (data as any)?.code ??
        (data as any)?.rawData ??
        (data as any)?.data ??
        data ??
        "",
    ).trim();

    if (!rawScanned) return;

    const meterIdPattern = /^MTR-[A-Za-z0-9-]+$/i;
    if (!meterIdPattern.test(rawScanned)) {
      return;
    }
    const meterId = rawScanned;

    setScanVisible(false);

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
    setScannerKey((k) => k + 1);
    setScanVisible(true);
    Keyboard.dismiss();
  };

  return (
    <View style={styles.grid}>
      {}
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
          <DatePickerField
            label="Date read"
            value={formDate}
            onChange={setFormDate}
          />
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

      {}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manage Meter Readings</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by Reading ID, Meter ID, date, value…"
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.filterRow}>
          {[
            { label: "ALL", val: "" },
            { label: "ELECTRIC", val: "electric" },
            { label: "WATER", val: "water" },
            { label: "GAS", val: "lpg" },
          ].map(({ label, val }) => (
            <TouchableOpacity
              key={label}
              style={[styles.chip, typeFilter === val && styles.chipActive]}
              onPress={() => setTypeFilter(val as any)}
            >
              <Text
                style={[
                  styles.chipText,
                  typeFilter === val && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={[styles.filterRow, { marginTop: -4 }]}>
          {[
            { label: "Newest", val: "date_desc" },
            { label: "Oldest", val: "date_asc" },
            { label: "ID ↑", val: "id_asc" },
            { label: "ID ↓", val: "id_desc" },
          ].map(({ label, val }) => (
            <TouchableOpacity
              key={val}
              style={[
                styles.chip,
                sortBy === (val as any) && styles.chipActive,
              ]}
              onPress={() => setSortBy(val as any)}
            >
              <Text
                style={[
                  styles.chipText,
                  sortBy === (val as any) && styles.chipTextActive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        {busy ? (
          <View style={styles.loader}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={visible}
            keyExtractor={(item) => item.reading_id}
            ListEmptyComponent={
              <Text style={styles.empty}>No readings found.</Text>
            }
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
                    Updated {formatDateTime(item.last_updated)} by{" "}
                    {item.updated_by}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.link}
                  onPress={() => openEdit(item)}
                >
                  <Text style={styles.linkText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.link, { marginLeft: 8 }]}
                  onPress={() => onDelete(item)}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={[styles.linkText, { color: "#e53935" }]}>
                      Delete
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      {}
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
          {}
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

              {}
              <Dropdown
                label="Meter"
                value={editMeterId}
                onChange={setEditMeterId}
                options={meters.map((m) => ({
                  label: `${m.meter_id} • ${m.meter_type} • ${m.meter_sn}`,
                  value: m.meter_id,
                }))}
              />

              {}
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
                  <Text
                    style={
                      styles.btnGhostText || [
                        styles.btnText,
                        { color: "#102a43" },
                      ]
                    }
                  >
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

      {}
      <Modal
        visible={scanVisible}
        animationType="fade"
        presentationStyle="fullScreen"
        statusBarTranslucent
        onRequestClose={() => setScanVisible(false)}
      >
        <View style={styles.scannerScreen}>
          {}
          <View style={styles.scannerFill}>
            <QRCodeScanner
              key={scannerKey}
              core={{ onSuccessfulScan: onScan }}
              scanning={{ cooldownDuration: 1200 }}
              uiControls={{
                showControls: true,
                showTorchButton: true,
                showStatus: true,
              }}
            />
          </View>

          {}
          <SafeAreaView style={styles.scanTopBar} pointerEvents="box-none">
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close scanner"
              onPress={() => setScanVisible(false)}
              style={styles.closeFab}
              hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
            >
              <Text style={styles.closeFabText}>×</Text>
            </TouchableOpacity>
          </SafeAreaView>

          {}
          {Platform.OS === "web" ? (
            <Text style={[styles.scanInfo, styles.scanTopInfo]}>
              Camera access requires HTTPS in the browser. If the camera does
              not start, please use the dropdown instead.
            </Text>
          ) : null}

          {}
          <SafeAreaView style={styles.scanFooter} pointerEvents="box-none">
            <Text style={styles.scanHint}>
              Point your camera at a meter QR code to quick-edit its latest
              reading or pre-fill the form.
            </Text>

            <TouchableOpacity
              style={[styles.btn, styles.scanCloseBtn]}
              onPress={() => setScanVisible(false)}
            >
              <Text style={styles.btnText}>Close</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
}

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
        <Picker
          selectedValue={value}
          onValueChange={(itemValue) => onChange(String(itemValue))}
          style={styles.picker}
        >
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

function pad(n: number) {
  return n < 10 ? `0${n}` : String(n);
}
function parseYMD(ymd: string) {
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(ymd || "");
  if (!m) {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = React.useState(false);
  const display = value || new Date().toISOString().slice(0, 10);
  return (
    <View style={{ flex: 1, marginTop: 8 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, styles.dateButton]}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.dateButtonText}>{display}</Text>
      </TouchableOpacity>
      <DatePickerModal
        visible={visible}
        initialDate={display}
        onClose={() => setVisible(false)}
        onConfirm={(d) => {
          onChange(d);
          setVisible(false);
        }}
      />
    </View>
  );
}

function DatePickerModal({
  visible,
  initialDate,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  initialDate: string;
  onClose: () => void;
  onConfirm: (value: string) => void;
}) {
  const now = new Date();
  const init = parseYMD(initialDate);
  const [y, setY] = React.useState(init.y);
  const [m, setM] = React.useState(init.m);
  const [d, setD] = React.useState(init.d);

  React.useEffect(() => {
    const max = daysInMonth(y, m);
    if (d > max) setD(max);
  }, [y, m, d]);

  const years = React.useMemo(() => {
    const cy = now.getFullYear();
    const start = cy - 10;
    const end = cy + 5;
    const arr: number[] = [];
    for (let i = start; i <= end; i++) arr.push(i);
    return arr;
  }, []);

  const months = React.useMemo(
    () => Array.from({ length: 12 }, (_, i) => i + 1),
    [],
  );
  const days = React.useMemo(
    () => Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1),
    [y, m],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalWrap}>
        <View style={styles.dateModalCard}>
          <Text style={styles.modalTitle}>Select date</Text>
          <View style={styles.datePickersRow}>
            <View style={styles.datePickerCol}>
              <Text style={styles.dropdownLabel}>Year</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={y}
                  onValueChange={(val) => setY(Number(val))}
                  style={styles.picker}
                >
                  {years.map((yy) => (
                    <Picker.Item key={yy} label={String(yy)} value={yy} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.datePickerCol}>
              <Text style={styles.dropdownLabel}>Month</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={m}
                  onValueChange={(val) => setM(Number(val))}
                  style={styles.picker}
                >
                  {months.map((mm) => (
                    <Picker.Item key={mm} label={pad(mm)} value={mm} />
                  ))}
                </Picker>
              </View>
            </View>
            <View style={styles.datePickerCol}>
              <Text style={styles.dropdownLabel}>Day</Text>
              <View style={styles.pickerWrapper}>
                <Picker
                  selectedValue={d}
                  onValueChange={(val) => setD(Number(val))}
                  style={styles.picker}
                >
                  {days.map((dd) => (
                    <Picker.Item key={dd} label={pad(dd)} value={dd} />
                  ))}
                </Picker>
              </View>
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost]}
              onPress={onClose}
            >
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#102a43",
    marginBottom: 12,
  },
  rowWrap: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    flexWrap: "wrap",
  },
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
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#102a43",
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
  },
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
  scannerBox: { flex: 1, width: "100%", alignSelf: "stretch" },
  scannerScreen: {
    flex: 1,
    backgroundColor: "#000",
  },
  scannerFill: {
    ...StyleSheet.absoluteFillObject,
  },
  scanTopBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    padding: 12,
    alignItems: "flex-start",
  },
  closeFab: {
    marginTop: 52,
    marginLeft: 9,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.95)",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.25,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 2 },
      },
      android: { elevation: 6 },
      web: { boxShadow: "0 6px 16px rgba(0,0,0,0.25)" as any },
    }),
  },
  closeFabText: {
    color: "#111827",
    fontSize: 26,
    lineHeight: 26,
    fontWeight: "800",
  },
  scanTopInfo: {
    position: "absolute",
    top: 64,
    left: 16,
    right: 16,
    textAlign: "center",
  },
  scanFooter: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  scanInfo: { color: "#e5e7eb", textAlign: "center", marginBottom: 8 },
  scanHint: { color: "#e5e7eb", textAlign: "center", marginBottom: 12 },
  dropdownLabel: {
    color: "#334e68",
    marginBottom: 6,
    marginTop: 6,
    fontWeight: "600",
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  picker: { height: 50 },
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
    borderColor: "#cbd5e1",
  },
  btnGhostText: {
    color: "#102a43",
    fontWeight: "700",
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: "#1f4bd8",
    borderColor: "#1f4bd8",
  },
  chipText: {
    color: "#102a43",
    fontWeight: "700",
    fontSize: 12,
  },
  chipTextActive: {
    color: "#fff",
  },
  scanCloseBtn: {
    alignSelf: "stretch",
  },
});