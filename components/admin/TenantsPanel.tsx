import React, { useEffect, useMemo, useState, useRef } from "react";
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
import { BASE_API } from "../../constants/api";

/** Types */
type Tenant = {
  tenant_id: string;
  tenant_sn: string;
  tenant_name: string;
  building_id: string;
  bill_start: string;      // YYYY-MM-DD
  last_updated: string;    // ISO
  updated_by: string;
};

type Building = {
  building_id: string;
  building_name: string;
};

/** Panel */
export default function TenantsPanel({ token }: { token: string | null }) {
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

  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [query, setQuery] = useState("");

  // Create form
  const [sn, setSn] = useState("");
  const [name, setName] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [billStart, setBillStart] = useState(today());

  // Edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editRow, setEditRow] = useState<Tenant | null>(null);
  const [editSn, setEditSn] = useState("");
  const [editName, setEditName] = useState("");
  const [editBuildingId, setEditBuildingId] = useState("");
  const [editBillStart, setEditBillStart] = useState(today());

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadAll = async () => {
    if (!token) {
      setBusy(false);
      Alert.alert("Not logged in", "Please log in to view tenants.");
      return;
    }
    try {
      setBusy(true);
      const [tRes, bRes] = await Promise.all([
        api.get<Tenant[]>("/tenants"),
        api.get<Building[]>("/buildings"),
      ]);
      setTenants(tRes.data);
      setBuildings(bRes.data);
      if (!buildingId && bRes.data?.length) setBuildingId(bRes.data[0].building_id);
    } catch (err: any) {
      // Employees without visible tenants will get 403 per API; show message instead of an error spam
      const msg =
        err?.response?.data?.error ||
        err?.response?.data?.message ||
        err?.message ||
        "Connection error.";
      Alert.alert("Load failed", msg);
    } finally {
      setBusy(false);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) =>
        t.tenant_id.toLowerCase().includes(q) ||
        t.tenant_sn.toLowerCase().includes(q) ||
        t.tenant_name.toLowerCase().includes(q) ||
        t.building_id.toLowerCase().includes(q) ||
        t.bill_start.toLowerCase().includes(q)
    );
  }, [tenants, query]);

  /** Create */
  const onCreate = async () => {
    if (!sn || !name || !buildingId || !billStart) {
      Alert.alert("Missing info", "Please fill in all fields.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/tenants", {
        tenant_sn: sn,
        tenant_name: name,
        building_id: buildingId,
        bill_start: billStart, // YYYY-MM-DD
      });
      setSn("");
      setName("");
      setBillStart(today());
      await loadAll();
      Alert.alert("Success", "Tenant created.");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Server error.";
      Alert.alert("Create failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Edit */
  const openEdit = (row: Tenant) => {
    setEditRow(row);
    setEditSn(row.tenant_sn);
    setEditName(row.tenant_name);
    setEditBuildingId(row.building_id);
    setEditBillStart(row.bill_start);
    setEditVisible(true);
  };

  const onUpdate = async () => {
    if (!editRow) return;
    try {
      setSubmitting(true);
      await api.put(`/tenants/${encodeURIComponent(editRow.tenant_id)}`, {
        tenant_sn: editSn,
        tenant_name: editName,
        building_id: editBuildingId,
        bill_start: editBillStart,
      });
      setEditVisible(false);
      await loadAll();
      Alert.alert("Updated", "Tenant updated successfully.");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Server error.";
      Alert.alert("Update failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Delete */
  const confirmDelete = (t: Tenant) =>
    Platform.OS === "web"
      ? Promise.resolve(
          // eslint-disable-next-line no-alert
          window.confirm(`Delete tenant ${t.tenant_name} (${t.tenant_id})?`)
        )
      : new Promise((resolve) => {
          Alert.alert(
            "Delete tenant",
            `Are you sure you want to delete ${t.tenant_name}?`,
            [
              { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
              { text: "Delete", style: "destructive", onPress: () => resolve(true) },
            ]
          );
        });

  const onDelete = async (t: Tenant) => {
    const ok = await confirmDelete(t);
    if (!ok) return;
    try {
      setSubmitting(true);
      await api.delete(`/tenants/${encodeURIComponent(t.tenant_id)}`);
      await loadAll();
      if (Platform.OS !== "web") Alert.alert("Deleted", "Tenant removed.");
    } catch (err: any) {
      const msg = err?.response?.data?.error ?? "Server error.";
      Alert.alert("Delete failed", msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** Render */
  return (
    <View style={styles.grid}>
      {/* Create Tenant */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Tenant</Text>
        <View style={styles.rowWrap}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Tenant SN"
            value={sn}
            onChangeText={setSn}
            autoCapitalize="characters"
          />
          <TextInput
            style={[styles.input, { flex: 2 }]}
            placeholder="Tenant Name"
            value={name}
            onChangeText={setName}
          />
        </View>

        <View style={styles.rowWrap}>
          <Dropdown
            label="Building"
            value={buildingId}
            onChange={setBuildingId}
            options={buildings.map((b) => ({
              label: `${b.building_name} (${b.building_id})`,
              value: b.building_id,
            }))}
          />
          <DatePickerField
            label="Bill start (YYYY-MM-DD)"
            value={billStart}
            onChange={setBillStart}
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
            <Text style={styles.btnText}>Create Tenant</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Manage Tenants */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manage Tenants</Text>
        <TextInput
          style={styles.search}
          placeholder="Search by ID, SN, name, building, date…"
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
            keyExtractor={(item) => item.tenant_id}
            ListEmptyComponent={<Text style={styles.empty}>No tenants found.</Text>}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.tenant_name}</Text>
                  <Text style={styles.rowSub}>
                    {item.tenant_id} • SN: {item.tenant_sn} • {item.building_id}
                  </Text>
                  <Text style={styles.rowSub}>
                    Bill start: {item.bill_start}
                  </Text>
                </View>
                <TouchableOpacity style={styles.link} onPress={() => openEdit(item)}>
                  <Text style={styles.linkText}>Edit</Text>
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

      {/* Edit Modal */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
<Text style={styles.modalTitle}>Edit {editRow?.tenant_id}</Text>

            <LabeledInput
              label="Tenant SN"
              value={editSn}
              onChangeText={setEditSn}
              placeholder="e.g., TNT000123"
              autoCapitalize="characters"
            />

            <LabeledInput
              label="Tenant Name"
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g., Mixue Ice Cream and Tea"
            />
            <Dropdown
              label="Building"
              value={editBuildingId}
              onChange={setEditBuildingId}
              options={buildings.map((b) => ({
                label: `${b.building_name} (${b.building_id})`,
                value: b.building_id,
              }))}
            />
            <DatePickerField
              label="Bill start (YYYY-MM-DD)"
              value={editBillStart}
              onChange={setEditBillStart}
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.btn, styles.btnGhost]}
                onPress={() => setEditVisible(false)}
              >
                <Text style={[styles.btnText, { color: "#102a43" }]}>Cancel</Text>
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

/** Shared UI bits **/
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
          onValueChange={(val) => onChange(String(val))}
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

/** Simple date utilities + picker (local, no external deps) **/
function today() {
  return new Date().toISOString().slice(0, 10);
}
function pad(n: number) { return n < 10 ? `0${n}` : String(n); }
function parseYMD(ymd: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd || "");
  if (!m) {
    const d = new Date();
    return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
  }
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}
function daysInMonth(y: number, m: number) { return new Date(y, m, 0).getDate(); }

function DatePickerField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={{ flex: 1, marginTop: 8 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TouchableOpacity
        style={[styles.input, styles.dateButton]}
        onPress={() => setVisible(true)}
      >
        <Text style={styles.dateButtonText}>{value || today()}</Text>
      </TouchableOpacity>
      <DatePickerModal
        visible={visible}
        initialDate={value || today()}
        onClose={() => setVisible(false)}
        onConfirm={(v) => {
          onChange(v);
          setVisible(false);
        }}
      />
    </View>
  );
}

function LabeledInput({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={{ width: "100%", marginTop: 8 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <TextInput
        style={[styles.input, { width: "100%" }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        autoCapitalize={autoCapitalize}
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
  const [y, setY] = useState(init.y);
  const [m, setM] = useState(init.m);
  const [d, setD] = useState(init.d);

  useEffect(() => {
    const max = daysInMonth(y, m);
    if (d > max) setD(max);
  }, [y, m]);

  const years = useMemo(() => {
    const cy = now.getFullYear();
    const arr: number[] = [];
    for (let i = cy - 20; i <= cy + 5; i++) arr.push(i);
    return arr;
  }, []);

  const months = useMemo(() => Array.from({ length: 12 }, (_, i) => i + 1), []);
  const days = useMemo(() => Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1), [y, m]);

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

/** Styles — mirrors your existing admin panels */
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
  rowWrap: { flexDirection: "row", gap: 12, flexWrap: "wrap", alignItems: "center" },
input: {
  borderWidth: 1,
  borderColor: "#d9e2ec",
  borderRadius: 10,
  paddingHorizontal: 12,
  paddingVertical: 10,
  backgroundColor: "#fff",
  color: "#102a43",
  marginTop: 6,
  minHeight: 50,       // ← add this
},

  dateButton: { justifyContent: "center" },
  dateButtonText: { color: "#102a43" },

  btn: {
    marginTop: 12, backgroundColor: "#1f4bd8",
    paddingVertical: 12, borderRadius: 12, alignItems: "center",
  },
  btnDisabled: { opacity: 0.7 },
  btnGhost: { backgroundColor: "#e6efff" },
  btnText: { color: "#fff", fontWeight: "700" },

  search: {
    borderWidth: 1, borderColor: "#d9e2ec", backgroundColor: "#fff",
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 12,
  },
  loader: { paddingVertical: 20, alignItems: "center" },
  empty: { textAlign: "center", color: "#627d98", paddingVertical: 16 },

  row: {
    borderWidth: 1, borderColor: "#edf2f7", backgroundColor: "#fdfefe",
    borderRadius: 12, padding: 12, marginBottom: 10,
    flexDirection: "row", alignItems: "center",
  },
  rowTitle: { fontWeight: "700", color: "#102a43" },
  rowSub: { color: "#627d98", marginTop: 2, fontSize: 12 },
  link: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: "#eef2ff" },
  linkText: { color: "#1f4bd8", fontWeight: "700" },

  modalWrap: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.5)", alignItems: "center", justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    width: "100%", maxWidth: 560, backgroundColor: "#fff", borderRadius: 20, padding: 16,
    ...Platform.select({
      web: { boxShadow: "0 20px 60px rgba(0,0,0,0.35)" as any },
      default: { elevation: 6 },
    }),
  },
  modalTitle: { fontWeight: "800", fontSize: 18, color: "#102a43", marginBottom: 10 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 12 },

  dropdownLabel: { color: "#334e68ff", fontWeight: "600", marginBottom: 6, marginTop: 6 },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
   borderRadius: 10,
    backgroundColor: "#fff",
    height: 50,                 
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  picker: {
    width: "100%",
    height: 50,                 
  },
  dateModalCard: {
    backgroundColor: "#fff",
    padding: 16,
    borderRadius: 16,
    width: "100%",
    maxWidth: 480,
  },
  datePickersRow: { flexDirection: "row", gap: 12 },
  datePickerCol: { flex: 1 },
  
});