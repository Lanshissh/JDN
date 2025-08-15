// components/admin/MeterPanel.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  Dimensions,
} from "react-native";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import QRCode from "react-native-qrcode-svg";
import { BASE_API } from "../../constants/api";

/** Types **/
type Meter = {
  meter_id: string;
  meter_type: "electric" | "water" | "lpg";
  meter_sn: string;
  meter_mult: number | null;
  stall_id: string;
  meter_status: "active" | "inactive";
  last_updated: string;
  updated_by: string;
};

type Stall = {
  stall_id: string;
  stall_sn: string;
};

export default function MeterPanel({ token }: { token: string | null }) {
  /** API **/
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
  const [meters, setMeters] = useState<Meter[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [query, setQuery] = useState("");

  /** QR modal **/
  const [qrVisible, setQrVisible] = useState(false);
  const [qrValue, setQrValue] = useState<string>("");

  /** Edit modal **/
  const [editVisible, setEditVisible] = useState(false);
  const [editId, setEditId] = useState("");
  const [editType, setEditType] = useState<Meter["meter_type"]>("electric");
  const [editSn, setEditSn] = useState("");
  const [editMult, setEditMult] = useState("");
  const [editStallId, setEditStallId] = useState("");
  const [editStatus, setEditStatus] = useState<Meter["meter_status"]>("inactive");

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadAll = async () => {
    if (!token) {
      setBusy(false);
      Alert.alert("Not logged in", "Please log in to manage meters.");
      return;
    }
    try {
      setBusy(true);
      const [mRes, sRes] = await Promise.all([
        api.get<Meter[]>("/meters"),
        api.get<Stall[]>("/stalls"),
      ]);
      // sort by meter_id ascending for stable view
      const sorted = [...mRes.data].sort((a, b) =>
        a.meter_id.localeCompare(b.meter_id)
      );
      setMeters(sorted);
      setStalls(sRes.data);
    } catch (err: any) {
      console.error("[METERS LOAD]", err?.response?.data || err?.message);
      Alert.alert(
        "Load failed",
        err?.response?.data?.error ?? "Please check your connection and permissions."
      );
    } finally {
      setBusy(false);
    }
  };

  /** Derived **/
  const stallsById = useMemo(() => {
    const map = new Map<string, Stall>();
    stalls.forEach((s) => map.set(s.stall_id, s));
    return map;
  }, [stalls]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meters;
    return meters.filter((m) => {
      const stall = stallsById.get(m.stall_id);
      return (
        m.meter_id.toLowerCase().includes(q) ||
        (m.meter_sn || "").toLowerCase().includes(q) ||
        m.meter_type.toLowerCase().includes(q) ||
        m.meter_status.toLowerCase().includes(q) ||
        (m.stall_id || "").toLowerCase().includes(q) ||
        (stall?.stall_sn || "").toLowerCase().includes(q)
      );
    });
  }, [meters, query, stallsById]);

  /** Actions **/
  const openQr = (meterId: string) => {
    setQrValue(meterId);
    setQrVisible(true);
  };

  const confirmDelete = (meterId: string) => {
    Alert.alert(
      "Delete meter?",
      `This will permanently remove ${meterId}.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => onDelete(meterId),
        },
      ]
    );
  };

  const onDelete = async (meterId: string) => {
    try {
      setSubmitting(true);
      await api.delete(`/meters/${encodeURIComponent(meterId)}`);
      await loadAll();
      Alert.alert("Deleted", "Meter removed.");
    } catch (err: any) {
      console.error("[DELETE METER]", err?.response?.data || err?.message);
      Alert.alert("Delete failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  /** EDIT (new) **/
  const openEdit = (m: Meter) => {
    setEditId(m.meter_id);
    setEditType(m.meter_type);
    setEditSn(m.meter_sn || "");
    setEditMult(m.meter_mult != null ? String(m.meter_mult) : "");
    setEditStallId(m.stall_id);
    setEditStatus(m.meter_status);
    setEditVisible(true);
  };

  const onUpdate = async () => {
    if (!editId) return;
    try {
      setSubmitting(true);
      await api.put(`/meters/${encodeURIComponent(editId)}`, {
        meter_type: editType,
        meter_sn: editSn,
        meter_mult: editMult.trim() === "" ? undefined : Number(editMult),
        stall_id: editStallId,
        meter_status: editStatus,
      });
      setEditVisible(false);
      await loadAll();
      Alert.alert("Updated", "Meter updated successfully.");
    } catch (err: any) {
      console.error("[UPDATE METER]", err?.response?.data || err?.message);
      Alert.alert("Update failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  /** Render **/
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Manage Meters</Text>
      <TextInput
        style={styles.search}
        placeholder="Search by ID, SN, type, stall, status..."
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
          keyExtractor={(item) => item.meter_id}
          ListEmptyComponent={<Text style={styles.empty}>No meters found.</Text>}
          renderItem={({ item }) => {
            const stall = stallsById.get(item.stall_id);
            return (
              <View style={styles.listRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {item.meter_id} ({item.meter_type})
                  </Text>
                  <Text style={styles.rowSub}>
                    {item.meter_sn || "—"} • {item.meter_status} • Stall:{" "}
                    {stall?.stall_sn || item.stall_id || "—"}
                  </Text>
                </View>

                {/* EDIT (new) */}
                <TouchableOpacity
                  style={[styles.link, { marginRight: 8 }]}
                  onPress={() => openEdit(item)}
                >
                  <Text style={styles.linkText}>Edit</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.link, { marginRight: 8 }]}
                  onPress={() => openQr(item.meter_id)}
                >
                  <Text style={styles.linkText}>QR Code</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.link}
                  onPress={() => confirmDelete(item.meter_id)}
                >
                  <Text style={[styles.linkText, { color: "#ef4444" }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* EDIT MODAL */}
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
              <Text style={styles.modalTitle}>Edit {editId}</Text>

              <Dropdown
                label="Type"
                value={editType}
                onChange={(v) => setEditType(v as Meter["meter_type"])}
                options={[
                  { label: "Electric", value: "electric" },
                  { label: "Water", value: "water" },
                  { label: "LPG", value: "lpg" },
                ]}
              />

<View style={styles.rowWrap}>
  <View style={{ flex: 1, marginTop: 8 }}>
    <Text style={styles.dropdownLabel}>Serial Number</Text>
    <TextInput
      style={styles.input}
      value={editSn}
      onChangeText={setEditSn}
      autoCapitalize="characters"
      placeholder="e.g. WDC-E-12345"
    />
  </View>

  <View style={{ flex: 1, marginTop: 8 }}>
    <Text style={styles.dropdownLabel}>Multiplier (optional)</Text>
    <TextInput
      style={styles.input}
      value={editMult}
      // keep only digits and one dot
      onChangeText={(t) => setEditMult(t.replace(/[^0-9.]/g, "").replace(/(\..*)\./g, "$1"))}
      keyboardType="numeric"
      inputMode="numeric"
      placeholder="1, 10, 100"
    />
  </View>
  </View>

              <Dropdown
                label="Stall"
                value={editStallId}
                onChange={setEditStallId}
                options={stalls.map((s) => ({
                  label: `${s.stall_sn} (${s.stall_id})`,
                  value: s.stall_id,
                }))}
              />

              <Dropdown
                label="Status"
                value={editStatus}
                onChange={(v) =>
                  setEditStatus(v as Meter["meter_status"])
                }
                options={[
                  { label: "Active", value: "active" },
                  { label: "Inactive", value: "inactive" },
                ]}
              />

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.btn, styles.btnGhost]}
                  onPress={() => setEditVisible(false)}
                >
                  <Text style={[styles.btnText, { color: "#102a43" }]}>Cancel</Text>
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

      {/* QR CODE MODAL */}
      <Modal
        visible={qrVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setQrVisible(false)}
      >
        <View style={styles.modalWrap}>
          <View style={styles.qrCard}>
            <Text style={styles.modalTitle}>Meter QR</Text>
            <View style={{ alignItems: "center", marginVertical: 12 }}>
              {!!qrValue && (
                <QRCode
                  value={qrValue}
                  size={220}
                />
              )}
              <Text style={{ marginTop: 8, color: "#334e68" }}>{qrValue}</Text>
            </View>

            <TouchableOpacity
              style={[styles.btn, { marginTop: 4 }]}
              onPress={() => setQrVisible(false)}
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
    <View style={{ marginTop: 8 }}>
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

/** Styles – mirrors your admin panel look **/
const styles = StyleSheet.create({
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

  link: {
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  linkText: { color: "#1f4bd8", fontWeight: "700" },

  /* Buttons */
  btn: {
    marginTop: 12,
    backgroundColor: "#1f4bd8",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnText: { color: "#fff", fontWeight: "700" },

  /* Modals */
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
    padding: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#102a43", marginBottom: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },

  /* QR card */
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    width: "100%",
    maxWidth: 360,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: "0 10px 30px rgba(0,0,0,0.15)" as any },
      default: { elevation: 3 },
    }),
  },

  /* Pickers */
  dropdownLabel: { color: "#334e68", marginBottom: 6, marginTop: 6, fontWeight: "600" },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#fff",
  },
  picker: { height: 50 },

  /* Variants */
  btnGhost: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: "#cbd5e1",
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
  minWidth: 160,
},
});
