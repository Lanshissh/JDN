// components/admin/MeterReadingPanel.tsx
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
import { BASE_API } from "../../constants/api";
import {
  QRCodeScanner,
  OnSuccessfulScanProps,
} from "@masumdev/rn-qrcode-scanner";

type Reading = {
  reading_id: string;
  meter_id: string;
  reading_value: number;
  read_by: string | null;
  lastread_date: string | null;
  last_updated: string;
  updated_by: string;
};

type Meter = {
  meter_id: string;
  meter_type: string;
  stall_id: string;
};

export default function MeterReadingPanel({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [query, setQuery] = useState("");

  const [scannerVisible, setScannerVisible] = useState(false);
  const [addVisible, setAddVisible] = useState(false);
  const [selectedMeter, setSelectedMeter] = useState<Meter | null>(null);
  const [lastReading, setLastReading] = useState<number | null>(null);
  const [newValue, setNewValue] = useState("");

  const [editVisible, setEditVisible] = useState(false);
  const [editReading, setEditReading] = useState<Reading | null>(null);
  const [editValue, setEditValue] = useState("");

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
      Alert.alert("Not logged in", "Please log in to view meter readings.");
      return;
    }
    try {
      setBusy(true);
      const res = await api.get<Reading[]>("/readings"); // matches backend /readings
      setReadings(res.data);
    } catch (err: any) {
      console.error("[READINGS LOAD]", err?.response?.data || err?.message);
      Alert.alert(
        "Load failed",
        err?.response?.data?.error ?? "Connection error."
      );
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [token]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return readings;
    return readings.filter(
      (r) =>
        r.reading_id.toLowerCase().includes(q) ||
        r.meter_id.toLowerCase().includes(q) ||
        String(r.reading_value).toLowerCase().includes(q) ||
        (r.read_by ?? "").toLowerCase().includes(q)
    );
  }, [readings, query]);

const handleScan = async (scanResult: OnSuccessfulScanProps) => {
  try {
    let scannedId = "";

    if (typeof (scanResult as any)?.data === "string") {
      scannedId = (scanResult as any).data;
    } else if (typeof (scanResult as any)?.rawData === "string") {
      scannedId = (scanResult as any).rawData;
    } else if (typeof (scanResult as any)?.message === "string") {
      scannedId = (scanResult as any).message;
    } else {
      scannedId = JSON.stringify(scanResult);
    }

    // 🔹 Normalize scanned value
    if (scannedId) {
      scannedId = scannedId.trim().toUpperCase();
    }

    if (!scannedId) {
      Alert.alert("Scan error", "Invalid QR code data.");
      return;
    }

    setScannerVisible(false);
    setSubmitting(true);

    const meterRes = await api.get<Meter>(`/meters/${scannedId}`);
    setSelectedMeter(meterRes.data);

    const meterReadings = readings
      .filter((r) => r.meter_id === scannedId)
      .sort(
        (a, b) =>
          new Date(b.lastread_date || 0).getTime() -
          new Date(a.lastread_date || 0).getTime()
      );
    setLastReading(meterReadings[0]?.reading_value ?? null);

    setNewValue("");
    setAddVisible(true);
  } catch (err: any) {
    console.error("[SCAN ERROR]", err?.response?.data || err?.message);
    Alert.alert(
      "Scan failed",
      err?.response?.data?.error ?? "Invalid meter QR or no access."
    );
  } finally {
    setSubmitting(false);
  }
};


  const onAddReading = async () => {
    if (!selectedMeter) return;
    if (!newValue) {
      Alert.alert("Missing value", "Please enter a reading value.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/readings", {
        meter_id: selectedMeter.meter_id,
        reading_value: parseFloat(newValue),
      });
      setAddVisible(false);
      await loadAll();
      Alert.alert("Success", "Reading added.");
    } catch (err: any) {
      console.error("[ADD READING]", err?.response?.data || err?.message);
      Alert.alert(
        "Add failed",
        err?.response?.data?.error ?? "Server error."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (r: Reading) => {
    setEditReading(r);
    setEditValue(String(r.reading_value));
    setEditVisible(true);
  };

  const onUpdate = async () => {
    if (!editReading) return;
    try {
      setSubmitting(true);
      await api.put(`/readings/${encodeURIComponent(editReading.reading_id)}`, {
        reading_value: parseFloat(editValue),
      });
      setEditVisible(false);
      await loadAll();
      Alert.alert("Updated", "Reading updated successfully.");
    } catch (err: any) {
      console.error("[UPDATE READING]", err?.response?.data || err?.message);
      Alert.alert(
        "Update failed",
        err?.response?.data?.error ?? "Server error."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const onDelete = async (r: Reading) => {
    const ok =
      Platform.OS === "web"
        ? window.confirm(`Delete reading ${r.reading_id}?`)
        : await new Promise<boolean>((resolve) => {
            Alert.alert(
              "Delete reading",
              `Are you sure you want to delete ${r.reading_id}?`,
              [
                { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
                { text: "Delete", style: "destructive", onPress: () => resolve(true) },
              ]
            );
          });
    if (!ok) return;

    try {
      setSubmitting(true);
      await api.delete(`/readings/${encodeURIComponent(r.reading_id)}`);
      await loadAll();
      if (Platform.OS !== "web") Alert.alert("Deleted", "Reading removed.");
    } catch (err: any) {
      console.error("[DELETE READING]", err?.response?.data || err?.message);
      Alert.alert(
        "Delete failed",
        err?.response?.data?.error ?? "Server error."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.grid}>
      {/* Scan & Add */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Scan to Add Reading</Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => setScannerVisible(true)}
        >
          <Text style={styles.btnText}>Scan Meter QR</Text>
        </TouchableOpacity>
      </View>

      {/* Manage Readings */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manage Readings</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by ID, meter, value…"
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
            ListEmptyComponent={
              <Text style={styles.empty}>No readings found.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>
                    {item.reading_id} — {item.meter_id}
                  </Text>
                  <Text style={styles.rowSub}>
                    Value: {item.reading_value} • By: {item.read_by ?? "N/A"}
                  </Text>
                  <Text style={styles.rowSub}>
                    Last Updated: {item.last_updated}
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
                >
                  <Text style={[styles.linkText, { color: "#e53935" }]}>
                    Delete
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>

      {/* Scanner Modal */}
      <Modal visible={scannerVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          {/* Custom header with X on left */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: "#000",
            }}
          >
            <TouchableOpacity
              onPress={() => setScannerVisible(false)}
              style={{
                backgroundColor: "#fff",
                width: 36,
                height: 36,
                borderRadius: 18,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  color: "#000",
                  fontSize: 20,
                  fontWeight: "bold",
                  lineHeight: 20,
                }}
              >
                ✕
              </Text>
            </TouchableOpacity>
          </View>

          {/* Scanner */}
          <QRCodeScanner
            core={{ onSuccessfulScan: handleScan }}
            permissionScreen={{}}
          />

          {/* Bottom cancel button */}
  <TouchableOpacity
    onPress={() => setScannerVisible(false)}
    style={{
      backgroundColor: '#ffffffff',
      width: 40,
      height: 40,
      borderRadius: 25,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 22,
      marginTop: 10,
    }}
  >
    <Text style={{ color: '#000', fontSize: 20, fontWeight: 'bold' }}>✕</Text>
  </TouchableOpacity>
        </View>
      </Modal>

      {/* Add Reading Modal */}
      <Modal visible={addVisible} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Add Reading</Text>
            {selectedMeter && (
              <>
                <Text>Meter ID: {selectedMeter.meter_id}</Text>
                <Text>Type: {selectedMeter.meter_type}</Text>
                <Text>Stall: {selectedMeter.stall_id}</Text>
                <Text>
                  Last Reading:{" "}
                  {lastReading !== null ? lastReading : "No previous reading"}
                </Text>
              </>
            )}
            <TextInput
              style={styles.input}
              placeholder="New reading value"
              keyboardType="numeric"
              value={newValue}
              onChangeText={setNewValue}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setAddVisible(false)}
              >
                <Text style={[styles.btnText, { color: "#102a43" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btn}
                onPress={onAddReading}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Reading Modal */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Reading</Text>
            {editReading && (
              <>
                <Text>ID: {editReading.reading_id}</Text>
                <Text>Meter: {editReading.meter_id}</Text>
              </>
            )}
            <TextInput
              style={styles.input}
              value={editValue}
              onChangeText={setEditValue}
              keyboardType="numeric"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setEditVisible(false)}
              >
                <Text style={[styles.btnText, { color: "#102a43" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.btn}
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
          </View>
        </View>
      </Modal>
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#102a43",
    marginBottom: 12,
  },
  btn: {
    marginTop: 12,
    backgroundColor: "#1f4bd8",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnGhost: { backgroundColor: "#e6efff" },
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
  modalWrap: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    ...Platform.select({
      web: { boxShadow: "0 20px 60px rgba(0,0,0,0.35)" as any },
      default: { elevation: 6 },
    }),
  },
  modalTitle: {
    fontWeight: "800",
    fontSize: 18,
    color: "#102a43",
    marginBottom: 10,
  },
  modalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    marginTop: 12,
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
});