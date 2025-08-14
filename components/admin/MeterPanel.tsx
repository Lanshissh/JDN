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
} from "react-native";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import QRCode from "react-native-qrcode-svg";
import { BASE_API } from "../../constants/api";

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

type Stall = {
  stall_id: string;
  stall_sn: string;
};

export default function MeterPanel({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [query, setQuery] = useState("");

  // Create form state
  const [type, setType] = useState<Meter["meter_type"]>("electric");
  const [sn, setSn] = useState("");
  const [mult, setMult] = useState("");
  const [stallId, setStallId] = useState("");
  const [status, setStatus] = useState<Meter["meter_status"]>("inactive");

  // QR modal
  const [qrVisible, setQrVisible] = useState(false);
  const [qrMeterId, setQrMeterId] = useState("");

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

  const loadAll = async () => {
    if (!token) {
      setBusy(false);
      Alert.alert("Not logged in", "Please log in as admin to manage meters.");
      return;
    }
    try {
      setBusy(true);
      const [metersRes, stallsRes] = await Promise.all([
        api.get<Meter[]>("/meters"),
        api.get<Stall[]>("/stalls"),
      ]);
      setMeters(metersRes.data);
      setStalls(stallsRes.data);
      if (!stallId && stallsRes.data.length) {
        setStallId(stallsRes.data[0].stall_id);
      }
    } catch (err: any) {
      console.error("[METERS LOAD]", err?.response?.data || err?.message);
      Alert.alert("Load failed", err?.response?.data?.error ?? "Connection error.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return meters;
    return meters.filter(
      (m) =>
        m.meter_id.toLowerCase().includes(q) ||
        m.meter_sn.toLowerCase().includes(q) ||
        m.meter_type.toLowerCase().includes(q) ||
        m.stall_id.toLowerCase().includes(q) ||
        m.meter_status.toLowerCase().includes(q)
    );
  }, [meters, query]);

  const onCreate = async () => {
    if (!type || !sn || !stallId || !status) {
      Alert.alert("Missing info", "Please fill in all required fields.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/meters", {
        meter_type: type,
        meter_sn: sn,
        meter_mult: mult ? parseFloat(mult) : undefined,
        stall_id: stallId,
        meter_status: status,
      });
      setSn("");
      setMult("");
      setType("electric");
      setStatus("inactive");
      await loadAll();
      Alert.alert("Success", "Meter created.");
    } catch (err: any) {
      console.error("[CREATE METER]", err?.response?.data || err?.message);
      Alert.alert("Create failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (meter: Meter) => {
    const ok =
      Platform.OS === "web"
        ? window.confirm(`Delete meter ${meter.meter_sn} (${meter.meter_id})?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete meter",
              `Are you sure you want to delete ${meter.meter_sn}?`,
              [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Delete", style: "destructive", onPress: () => resolve(true) },
              ]
            );
          });
    if (!ok) return;
    try {
      setSubmitting(true);
      await api.delete(`/meters/${encodeURIComponent(meter.meter_id)}`);
      await loadAll();
      if (Platform.OS !== "web") Alert.alert("Deleted", "Meter removed.");
    } catch (err: any) {
      console.error("[DELETE METER]", err?.response?.data || err?.message);
      Alert.alert("Delete failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.grid}>
      {/* Create Meter */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Meter</Text>
        <Dropdown
          label="Type"
          value={type}
          onChange={(v) => setType(v as Meter["meter_type"])}
          options={[
            { label: "Electric", value: "electric" },
            { label: "Water", value: "water" },
            { label: "LPG", value: "lpg" },
          ]}
        />
        <TextInput
          style={styles.input}
          placeholder="Serial Number"
          value={sn}
          onChangeText={setSn}
        />
        <TextInput
          style={styles.input}
          placeholder="Multiplier (optional)"
          value={mult}
          onChangeText={setMult}
          keyboardType="numeric"
        />
        <Dropdown
          label="Stall"
          value={stallId}
          onChange={setStallId}
          options={stalls.map((s) => ({
            label: `${s.stall_sn} (${s.stall_id})`,
            value: s.stall_id,
          }))}
        />
        <Dropdown
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as Meter["meter_status"])}
          options={[
            { label: "Active", value: "active" },
            { label: "Inactive", value: "inactive" },
          ]}
        />
        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={onCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Create Meter</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Manage Meters */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manage Meters</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by ID, SN, type, stall, status…"
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
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {item.meter_sn} ({item.meter_type})
                  </Text>
                  <Text style={styles.rowSub}>
                    {item.meter_id} • {item.meter_status} • Stall: {item.stall_id}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.link}
                  onPress={() => {
                    setQrMeterId(item.meter_id.trim()); // ✅ exact DB match
                    setQrVisible(true);
                  }}
                >
                  <Text style={styles.linkText}>QR Code</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.link, { marginLeft: 8 }]}
                  onPress={() => onDelete(item)}
                >
                  <Text style={[styles.linkText, { color: "#e53935" }]}>Delete</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

{/* QR Code Modal */}
<Modal visible={qrVisible} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <View style={styles.qrCard}>
      {/* Header */}
      <View style={styles.qrHeader}>
        <Text style={styles.qrTitle}>QR Code</Text>
        <Text style={styles.qrSubtitle}>{qrMeterId?.toUpperCase()}</Text>
      </View>

      {/* QR Code */}
      <View style={styles.qrContainer}>
        <QRCode
          value={qrMeterId ? qrMeterId.toUpperCase() : ""}
          size={220}
          backgroundColor="white"
          color="#000"
        />
      </View>

      {/* Close Button */}
      <TouchableOpacity
        style={styles.closeBtn}
        onPress={() => setQrVisible(false)}
      >
        <Text style={styles.closeText}>Close</Text>
      </TouchableOpacity>
    </View>
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
    <View style={{ marginTop: 8 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <View style={styles.pickerWrapper}>
        <Picker
          selectedValue={value}
          onValueChange={(itemValue) => onChange(itemValue)}
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
  row: {
    borderWidth: 1,
    borderColor: "#edf2f7",
    backgroundColor: "#fdfefe",
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  rowTitle: { fontWeight: "700", color: "#102a43" },
  rowSub: { color: "#627d98", marginTop: 2, fontSize: 12 },
  link: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: "#eef2ff",
  },
  linkText: { color: "#1f4bd8", fontWeight: "700" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  qrCard: {
    backgroundColor: "#fff",
    borderRadius: 24,
    width: "90%",
    maxWidth: 400,
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  qrHeader: {
    backgroundColor: "#1f4bd8",
    paddingTop: 14,
    paddingBottom: 8,
    alignItems: "center",
  },
  qrTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  qrSubtitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#dbeafe",
    marginTop: 2,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
  },
  closeBtn: {
    backgroundColor: "#1f4bd8",
    marginHorizontal: 20,
    marginBottom: 20,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
  },
  closeText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
  dropdownLabel: { color: "#334e68ff", fontWeight: "600", marginBottom: 6, marginTop: 6 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  picker: { height: 55, width: "100%" },
});