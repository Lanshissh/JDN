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
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import QRCode from "react-native-qrcode-svg";
import { BASE_API } from "../../constants/api";

export type Meter = {
  meter_id: string;
  meter_type: "electric" | "water" | "lpg";
  meter_sn: string;
  meter_mult: number;
  stall_id: string;
  meter_status: "active" | "inactive";
  last_updated: string;
  updated_by: string;
};

export type Stall = {
  stall_id: string;
  stall_sn: string;
};

export default function MeterPanel({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [query, setQuery] = useState("");

  const [filterType, setFilterType] = useState<
    "all" | "electric" | "water" | "lpg"
  >("all");

  // Sort state
  const [sortBy, setSortBy] = useState<
    "id_asc" | "id_desc" | "type" | "stall" | "status"
  >("id_asc");

  const [type, setType] = useState<Meter["meter_type"]>("electric");
  const [sn, setSn] = useState("");
  const [mult, setMult] = useState("1.00");
  const [stallId, setStallId] = useState("");
  const [status, setStatus] = useState<Meter["meter_status"]>("inactive");

  const [editVisible, setEditVisible] = useState(false);
  const [editRow, setEditRow] = useState<Meter | null>(null);
  const [editType, setEditType] = useState<Meter["meter_type"]>("electric");
  const [editSn, setEditSn] = useState("");
  const [editMult, setEditMult] = useState("1.00");
  const [editStallId, setEditStallId] = useState("");
  const [editStatus, setEditStatus] =
    useState<Meter["meter_status"]>("inactive");

  const [qrVisible, setQrVisible] = useState(false);
  const [qrMeterId, setQrMeterId] = useState("");
  const qrRef = useRef<any>(null);

  const authHeader = useMemo(
    () => ({ Authorization: `Bearer ${token ?? ""}` }),
    [token],
  );
  const api = useMemo(
    () =>
      axios.create({ baseURL: BASE_API, headers: authHeader, timeout: 15000 }),
    [authHeader],
  );

  useEffect(() => {
    loadAll();
  }, [token]);

  const loadAll = async () => {
    if (!token) return;
    try {
      setBusy(true);
      const [metersRes, stallsRes] = await Promise.all([
        api.get<Meter[]>("/meters"),
        api.get<Stall[]>("/stalls"),
      ]);
      setMeters(metersRes.data || []);
      setStalls(stallsRes.data || []);
    } catch (err: any) {
      console.error("[METERS LOAD]", err?.response?.data || err?.message);
      Alert.alert("Load failed", "Could not load meters/stalls.");
    } finally {
      setBusy(false);
    }
  };

  // Search + type filter
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = meters;
    if (filterType !== "all") {
      list = list.filter((m) => m.meter_type === filterType);
    }
    if (!q) return list;
    return list.filter((m) =>
      [m.meter_id, m.meter_sn, m.meter_type, m.stall_id, m.meter_status]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [meters, query, filterType]);

  // helper: numeric part from meter_id like "MTR-12"
  const mtrNum = (id: string) => {
    const m = /^MTR-(\d+)/i.exec(id || "");
    return m ? parseInt(m[1], 10) : Number.MAX_SAFE_INTEGER;
  };

  // Sorting
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "id_desc":
        arr.sort(
          (a, b) =>
            mtrNum(b.meter_id) - mtrNum(a.meter_id) ||
            b.meter_id.localeCompare(a.meter_id),
        );
        break;
      case "type":
        arr.sort(
          (a, b) =>
            a.meter_type.localeCompare(b.meter_type) ||
            mtrNum(a.meter_id) - mtrNum(b.meter_id),
        );
        break;
      case "stall":
        arr.sort(
          (a, b) =>
            (a.stall_id || "").localeCompare(b.stall_id || "") ||
            mtrNum(a.meter_id) - mtrNum(b.meter_id),
        );
        break;
      case "status":
        // active first, then inactive
        const rank = (s: Meter["meter_status"]) => (s === "active" ? 0 : 1);
        arr.sort(
          (a, b) =>
            rank(a.meter_status) - rank(b.meter_status) ||
            mtrNum(a.meter_id) - mtrNum(b.meter_id),
        );
        break;
      case "id_asc":
      default:
        arr.sort(
          (a, b) =>
            mtrNum(a.meter_id) - mtrNum(b.meter_id) ||
            a.meter_id.localeCompare(b.meter_id),
        );
        break;
    }
    return arr;
  }, [filtered, sortBy]);

  const onCreate = async () => {
    if (!sn.trim() || !stallId.trim()) {
      Alert.alert("Missing info", "Serial number and Stall are required.");
      return;
    }
    const payload = {
      meter_type: type,
      meter_sn: sn.trim(),
      meter_mult: Number(mult) || 1,
      stall_id: stallId.trim(),
      meter_status: status,
    };
    try {
      setSubmitting(true);
      await api.post("/meters", payload);
      Alert.alert("Success", "Meter added.");
      setSn("");
      setMult("1.00");
      setStallId("");
      setStatus("inactive");
      await loadAll();
    } catch (err: any) {
      console.error("[METER CREATE]", err?.response?.data || err?.message);
      Alert.alert(
        "Create failed",
        err?.response?.data?.message || "Unable to add meter.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (m: Meter) => {
    setEditRow(m);
    setEditType(m.meter_type);
    setEditSn(m.meter_sn);
    setEditMult(String(m.meter_mult ?? "1"));
    setEditStallId(m.stall_id);
    setEditStatus(m.meter_status);
    setEditVisible(true);
  };

  const onUpdate = async () => {
    if (!editRow) return;
    try {
      setSubmitting(true);
      await api.put(`/meters/${encodeURIComponent(editRow.meter_id)}`, {
        meter_type: editType,
        meter_sn: editSn.trim(),
        meter_mult: Number(editMult) || 1,
        stall_id: editStallId.trim(),
        meter_status: editStatus,
      });
      setEditVisible(false);
      await loadAll();
      Alert.alert("Updated", "Meter updated successfully.");
    } catch (err: any) {
      console.error("[METER UPDATE]", err?.response?.data || err?.message);
      Alert.alert(
        "Update failed",
        err?.response?.data?.error || "Server error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (m: Meter): Promise<boolean> =>
    Platform.OS === "web"
      ? Promise.resolve(window.confirm(`Delete meter ${m.meter_id}?`))
      : new Promise((resolve) => {
          Alert.alert(
            "Delete meter",
            `Are you sure you want to delete ${m.meter_id}?`,
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: () => resolve(false),
              },
              {
                text: "Delete",
                style: "destructive",
                onPress: () => resolve(true),
              },
            ],
          );
        });

  const onDelete = async (m: Meter) => {
    const ok = await confirmDelete(m);
    if (!ok) return;
    try {
      setSubmitting(true);
      await api.delete(`/meters/${encodeURIComponent(m.meter_id)}`);
      await loadAll();
      if (Platform.OS !== "web") Alert.alert("Deleted", "Meter removed.");
    } catch (err: any) {
      Alert.alert(
        "Delete failed",
        err?.response?.data?.error || "Server error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openQr = (meter_id: string) => {
    setQrMeterId(meter_id);
    setQrVisible(true);
  };

  const downloadQr = () => {
    if (!qrRef.current) return;
    try {
      qrRef.current.toDataURL((data: string) => {
        const dataUrl = `data:image/png;base64,${data}`;
        if (Platform.OS === "web" && typeof document !== "undefined") {
          const a = document.createElement("a");
          a.href = dataUrl;
          a.download = `${qrMeterId || "meter-qr"}.png`;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else {
          Alert.alert(
            "Save QR",
            "On mobile, please take a screenshot of this QR.",
          );
        }
      });
    } catch (err) {
      console.error("[QR DOWNLOAD]", err);
      Alert.alert("Download failed", "Could not generate QR image.");
    }
  };

  if (busy) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Add Meter */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Add Meter</Text>

          {/* Type */}
          <Text style={styles.label}>Type</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={type}
              onValueChange={(v) => setType(v)}
              style={styles.picker}
            >
              <Picker.Item label="Electric" value="electric" />
              <Picker.Item label="Water" value="water" />
              <Picker.Item label="LPG (Gas)" value="lpg" />
            </Picker>
          </View>

          {/* Serial Number */}
          <Text style={styles.label}>Serial Number</Text>
          <TextInput
            value={sn}
            onChangeText={setSn}
            placeholder="e.g. WDC-E-12345"
            style={styles.input}
          />

          {/* Multiplier */}
          <Text style={styles.label}>Multiplier</Text>
          <TextInput
            value={mult}
            onChangeText={setMult}
            keyboardType="numeric"
            placeholder="1.00"
            style={styles.input}
          />

          {/* Stall */}
          <Text style={styles.label}>Stall</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={stallId}
              onValueChange={(v) => setStallId(v)}
              style={styles.picker}
            >
              <Picker.Item label="Select a stall" value="" />
              {stalls.map((s) => (
                <Picker.Item
                  key={s.stall_id}
                  label={`${s.stall_id} • ${s.stall_sn || ""}`}
                  value={s.stall_id}
                />
              ))}
            </Picker>
          </View>

          {/* Status */}
          <Text style={styles.label}>Status</Text>
          <View style={styles.pickerWrap}>
            <Picker
              selectedValue={status}
              onValueChange={(v) => setStatus(v)}
              style={styles.picker}
            >
              <Picker.Item label="Inactive" value="inactive" />
              <Picker.Item label="Active" value="active" />
            </Picker>
          </View>

          <TouchableOpacity
            style={[styles.btn, submitting && { opacity: 0.7 }]}
            onPress={onCreate}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnText}>Add Meter</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Manage Meters */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Manage Meters</Text>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by ID, SN, type, stall, status"
            style={styles.input}
          />

          {/* Filter chips */}
          <View style={styles.filterRow}>
            <Chip
              label="All"
              active={filterType === "all"}
              onPress={() => setFilterType("all")}
            />
            <Chip
              label="Electric"
              active={filterType === "electric"}
              onPress={() => setFilterType("electric")}
            />
            <Chip
              label="Water"
              active={filterType === "water"}
              onPress={() => setFilterType("water")}
            />
            <Chip
              label="Gas"
              active={filterType === "lpg"}
              onPress={() => setFilterType("lpg")}
            />
          </View>

          {/* Sort chips */}
          <View style={[styles.filterRow, { marginTop: -4 }]}>
            <Chip
              label="ID ↑"
              active={sortBy === "id_asc"}
              onPress={() => setSortBy("id_asc")}
            />
            <Chip
              label="ID ↓"
              active={sortBy === "id_desc"}
              onPress={() => setSortBy("id_desc")}
            />
            <Chip
              label="Type"
              active={sortBy === "type"}
              onPress={() => setSortBy("type")}
            />
            <Chip
              label="Stall"
              active={sortBy === "stall"}
              onPress={() => setSortBy("stall")}
            />
            <Chip
              label="Status"
              active={sortBy === "status"}
              onPress={() => setSortBy("status")}
            />
          </View>

          {/* List */}
          {sorted.length === 0 ? (
            <Text style={{ paddingVertical: 12, color: "#666" }}>
              No meters found.
            </Text>
          ) : (
            <FlatList
              data={sorted}
              keyExtractor={(item) => item.meter_id}
              renderItem={({ item }) => (
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{item.meter_id}</Text>
                    <Text style={styles.rowSub}>
                      {item.meter_type.toUpperCase()} • SN: {item.meter_sn} •
                      Mult: {item.meter_mult} • Stall: {item.stall_id} •{" "}
                      {item.meter_status}
                    </Text>
                  </View>

                  {/* Actions */}
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <TouchableOpacity
                      style={styles.pill}
                      onPress={() => openQr(item.meter_id)}
                    >
                      <Text style={styles.pillTextEdit}>QR</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.pill}
                      onPress={() => openEdit(item)}
                    >
                      <Text style={styles.pillTextEdit}>Edit</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.pill}
                      onPress={() => onDelete(item)}
                    >
                      <Text style={styles.pillTextDelete}>Delete</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            />
          )}
        </View>

        {/* QR Modal */}
        <Modal
          visible={qrVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setQrVisible(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.qrCard}>
              <Text style={styles.qrTitle}>QR Code</Text>
              <Text style={styles.qrSub}>{qrMeterId}</Text>
              <View style={styles.qrWrap}>
                <QRCode
                  value={qrMeterId}
                  size={220}
                  backgroundColor="white"
                  color="#000"
                  getRef={(c: any) => (qrRef.current = c)}
                />
              </View>

              {Platform.OS === "web" && (
                <TouchableOpacity
                  style={{
                    marginTop: 14,
                    backgroundColor: "#1f4bd8",
                    paddingVertical: 12,
                    borderRadius: 10,
                    alignItems: "center",
                    width: "50%",
                    alignSelf: "center",
                  }}
                  onPress={downloadQr}
                >
                  <Text style={styles.btnText}>Download QR (PNG)</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setQrVisible(false)}
              >
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* Edit Modal */}
        <Modal
          visible={editVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setEditVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.modalOverlay}
          >
            <View style={styles.editCard}>
              <ScrollView contentContainerStyle={{ paddingHorizontal: 16 }}>
                <Text style={styles.qrTitle}>Edit Meter</Text>
                <Text style={styles.qrSub}>{editRow?.meter_id}</Text>

                {/* Type */}
                <Text style={styles.label}>Type</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={editType}
                    onValueChange={(v) => setEditType(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Electric" value="electric" />
                    <Picker.Item label="Water" value="water" />
                    <Picker.Item label="LPG (Gas)" value="lpg" />
                  </Picker>
                </View>

                {/* Serial Number */}
                <Text style={styles.label}>Serial Number</Text>
                <TextInput
                  value={editSn}
                  onChangeText={setEditSn}
                  placeholder="e.g. WDC-E-12345"
                  style={styles.input}
                />

                {/* Multiplier */}
                <Text style={styles.label}>Multiplier</Text>
                <TextInput
                  value={editMult}
                  onChangeText={setEditMult}
                  keyboardType="numeric"
                  placeholder="1.00"
                  style={styles.input}
                />

                {/* Stall */}
                <Text style={styles.label}>Stall</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={editStallId}
                    onValueChange={(v) => setEditStallId(v)}
                    style={styles.picker}
                  >
                    {stalls.map((s) => (
                      <Picker.Item
                        key={s.stall_id}
                        label={`${s.stall_id} • ${s.stall_sn || ""}`}
                        value={s.stall_id}
                      />
                    ))}
                  </Picker>
                </View>

                {/* Status */}
                <Text style={styles.label}>Status</Text>
                <View style={styles.pickerWrap}>
                  <Picker
                    selectedValue={editStatus}
                    onValueChange={(v) => setEditStatus(v)}
                    style={styles.picker}
                  >
                    <Picker.Item label="Inactive" value="inactive" />
                    <Picker.Item label="Active" value="active" />
                  </Picker>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                  <TouchableOpacity
                    style={[styles.btn, styles.btnGhost]}
                    onPress={() => setEditVisible(false)}
                  >
                    <Text style={[styles.btnText, { color: "#102a43" }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.btn, submitting && { opacity: 0.7 }]}
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}
    >
      <Text
        style={[
          styles.chipText,
          active ? styles.chipTextActive : styles.chipTextIdle,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 16,
    gap: 16,
    backgroundColor: "#f5f7fb",
  },
  center: { alignItems: "center", justifyContent: "center" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  label: { fontSize: 12, color: "#374151", marginTop: 10, marginBottom: 6 },
  input: {
    height: 48,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
  },
  pickerWrap: {
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 10,
    overflow: "hidden",
  },
  picker: { height: 48, width: "100%" },
  btn: {
    marginTop: 14,
    backgroundColor: "#1f4bd8",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    paddingHorizontal: 16,
  },
  btnGhost: { backgroundColor: "#e6efff" },
  btnText: { color: "#fff", fontWeight: "700" },

  link: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignSelf: "center",
    backgroundColor: "#fff",
  },
  linkText: { color: "#102a43", fontWeight: "700" },

  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: "#2f6fed", borderColor: "#2f6fed" },
  chipIdle: { backgroundColor: "#fff", borderColor: "#bcccdc" },
  chipText: { fontSize: 12, fontWeight: "700" },
  chipTextActive: { color: "#fff" },
  chipTextIdle: { color: "#334e68" },

  row: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    gap: 12,
  },
  rowTitle: { fontSize: 16, fontWeight: "700" },
  rowSub: { color: "#6b7280", marginTop: 2 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  qrCard: {
    width: 340,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    paddingVertical: 16,
  },
  qrTitle: { fontSize: 18, fontWeight: "800", textAlign: "center" },
  qrSub: { fontSize: 12, color: "#6b7280", textAlign: "center", marginTop: 2 },
  qrWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
  },
  closeBtn: {
    backgroundColor: "#111827",
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  closeText: { color: "#fff", fontWeight: "700" },

  editCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 16,
  },

  pill: {
    backgroundColor: "#EEF2FF",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  pillTextEdit: {
    fontWeight: "700",
    color: "#1f4bd8",
  },
  pillTextDelete: {
    fontWeight: "700",
    color: "#ef4444",
  },
});