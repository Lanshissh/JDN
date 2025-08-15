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
import { BASE_API } from "../../constants/api";

type Stall = {
  stall_id: string;
  stall_sn: string;
  tenant_id: string | null;
  building_id: string;
  stall_status: "occupied" | "available" | "under maintenance";
  last_updated: string;
  updated_by: string;
};

type Building = {
  building_id: string;
  building_name: string;
};

type Tenant = {
  tenant_id: string;
  tenant_name: string;
};

const cmp = (a: string | number, b: string | number) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });

const dateOf = (s: Stall) => Date.parse(s.last_updated || "") || 0;

export default function StallsPanel({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [query, setQuery] = useState("");

  const [buildingFilter, setBuildingFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"" | Stall["stall_status"]>(
    "",
  );

  const [stallSn, setStallSn] = useState("");
  const [buildingId, setBuildingId] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [status, setStatus] = useState<Stall["stall_status"]>("available");

  const [editVisible, setEditVisible] = useState(false);
  const [editStall, setEditStall] = useState<Stall | null>(null);

  type SortMode = "newest" | "oldest" | "idAsc" | "idDesc";
  const [sortMode, setSortMode] = useState<SortMode>("newest");

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

  const loadAll = async () => {
    if (!token) {
      setBusy(false);
      Alert.alert("Not logged in", "Please log in as admin to manage stalls.");
      return;
    }
    try {
      setBusy(true);
      const [stallsRes, buildingsRes, tenantsRes] = await Promise.all([
        api.get<Stall[]>("/stalls"),
        api.get<Building[]>("/buildings"),
        api.get<Tenant[]>("/tenants"),
      ]);
      setStalls(stallsRes.data);
      setBuildings(buildingsRes.data);
      setTenants(tenantsRes.data);
      if (!buildingId && buildingsRes.data?.length) {
        setBuildingId(buildingsRes.data[0].building_id);
      }
    } catch (err: any) {
      console.error("[STALLS LOAD]", err?.response?.data || err?.message);
      Alert.alert(
        "Load failed",
        err?.response?.data?.error ?? "Connection error.",
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
    let list = stalls;

    if (buildingFilter) {
      list = list.filter((s) => s.building_id === buildingFilter);
    }

    if (statusFilter) {
      list = list.filter((s) => s.stall_status === statusFilter);
    }

    if (!q) return list;
    return list.filter(
      (s) =>
        s.stall_id.toLowerCase().includes(q) ||
        s.stall_sn.toLowerCase().includes(q) ||
        s.building_id.toLowerCase().includes(q) ||
        (s.tenant_id?.toLowerCase() ?? "").includes(q) ||
        s.stall_status.toLowerCase().includes(q),
    );
  }, [stalls, query, buildingFilter, statusFilter]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case "newest":
        return arr.sort((a, b) => dateOf(b) - dateOf(a));
      case "oldest":
        return arr.sort((a, b) => dateOf(a) - dateOf(b));
      case "idAsc":
        return arr.sort((a, b) => cmp(a.stall_id, b.stall_id));
      case "idDesc":
        return arr.sort((a, b) => cmp(b.stall_id, a.stall_id));
      default:
        return arr;
    }
  }, [filtered, sortMode]);

  const onCreate = async () => {
    if (!stallSn || !buildingId || !status) {
      Alert.alert("Missing info", "Please fill in all required fields.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/stalls", {
        stall_sn: stallSn,
        tenant_id: status === "available" ? null : tenantId || null,
        building_id: buildingId,
        stall_status: status,
      });
      setStallSn("");
      setTenantId("");
      setStatus("available");
      await loadAll();
      Alert.alert("Success", "Stall created.");
    } catch (err: any) {
      console.error("[CREATE STALL]", err?.response?.data || err?.message);
      Alert.alert(
        "Create failed",
        err?.response?.data?.error ?? "Server error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (stall: Stall) => {
    setEditStall({ ...stall });
    setEditVisible(true);
  };

  const onUpdate = async () => {
    if (!editStall) return;
    try {
      setSubmitting(true);
      await api.put(`/stalls/${encodeURIComponent(editStall.stall_id)}`, {
        stall_sn: editStall.stall_sn,
        tenant_id:
          editStall.stall_status === "available"
            ? null
            : editStall.tenant_id || null,
        building_id: editStall.building_id,
        stall_status: editStall.stall_status,
      });
      setEditVisible(false);
      await loadAll();
      Alert.alert("Updated", "Stall updated successfully.");
    } catch (err: any) {
      console.error("[UPDATE STALL]", err?.response?.data || err?.message);
      Alert.alert(
        "Update failed",
        err?.response?.data?.error ?? "Server error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (stall: Stall) =>
    Platform.OS === "web"
      ? Promise.resolve(
          window.confirm(`Delete stall ${stall.stall_sn} (${stall.stall_id})?`),
        )
      : new Promise((resolve) => {
          Alert.alert(
            "Delete stall",
            `Are you sure you want to delete ${stall.stall_sn}?`,
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

  const onDelete = async (stall: Stall) => {
    const ok = await confirmDelete(stall);
    if (!ok) return;
    try {
      setSubmitting(true);
      await api.delete(`/stalls/${encodeURIComponent(stall.stall_id)}`);
      await loadAll();
      if (Platform.OS !== "web") Alert.alert("Deleted", "Stall removed.");
    } catch (err: any) {
      console.error("[DELETE STALL]", err?.response?.data || err?.message);
      Alert.alert(
        "Delete failed",
        err?.response?.data?.error ?? "Server error.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.grid}>
      {}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Stall</Text>
        <TextInput
          style={styles.input}
          placeholder="Stall SN"
          value={stallSn}
          onChangeText={setStallSn}
        />
        <Dropdown
          label="Building"
          value={buildingId}
          onChange={setBuildingId}
          options={buildings.map((b) => ({
            label: `${b.building_name} (${b.building_id})`,
            value: b.building_id,
          }))}
        />
        <Dropdown
          label="Status"
          value={status}
          onChange={(v) => setStatus(v as Stall["stall_status"])}
          options={[
            { label: "Available", value: "available" },
            { label: "Occupied", value: "occupied" },
            { label: "Under Maintenance", value: "under maintenance" },
          ]}
        />
        {status !== "available" && (
          <Dropdown
            label="Tenant"
            value={tenantId}
            onChange={setTenantId}
            options={[
              { label: "None", value: "" },
              ...tenants.map((t) => ({
                label: `${t.tenant_name} (${t.tenant_id})`,
                value: t.tenant_id,
              })),
            ]}
          />
        )}
        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={onCreate}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>Create Stall</Text>
          )}
        </TouchableOpacity>
      </View>

      {}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manage Stalls</Text>

        {}
        <TextInput
          style={styles.search}
          placeholder="Search by ID, SN, tenant, building, status…"
          value={query}
          onChangeText={setQuery}
        />

        {}
        <View style={styles.filtersBar}>
          <View style={styles.filterCol}>
            <Dropdown
              label="Filter by Building"
              value={buildingFilter}
              onChange={setBuildingFilter}
              options={[
                { label: "All Buildings", value: "" },
                ...buildings.map((b) => ({
                  label: `${b.building_name} (${b.building_id})`,
                  value: b.building_id,
                })),
              ]}
            />
          </View>

          <View style={styles.filterCol}>
            <Dropdown
              label="Filter by Status"
              value={statusFilter}
              onChange={(v) => setStatusFilter(v as any)}
              options={[
                { label: "All Statuses", value: "" },
                { label: "Available", value: "available" },
                { label: "Occupied", value: "occupied" },
                { label: "Under Maintenance", value: "under maintenance" },
              ]}
            />
          </View>

          {(!!buildingFilter || !!statusFilter) && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setBuildingFilter("");
                setStatusFilter("");
              }}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>

        {}
        <View style={styles.chipsRow}>
          <Chip
            label="Newest"
            active={sortMode === "newest"}
            onPress={() => setSortMode("newest")}
          />
          <Chip
            label="Oldest"
            active={sortMode === "oldest"}
            onPress={() => setSortMode("oldest")}
          />
          <Chip
            label="ID ↑"
            active={sortMode === "idAsc"}
            onPress={() => setSortMode("idAsc")}
          />
          <Chip
            label="ID ↓"
            active={sortMode === "idDesc"}
            onPress={() => setSortMode("idDesc")}
          />
        </View>

        {busy ? (
          <View style={styles.loader}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.stall_id}
            ListEmptyComponent={
              <Text style={styles.empty}>No stalls found.</Text>
            }
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.stall_sn}</Text>
                  <Text style={styles.rowSub}>
                    {item.stall_id} • {item.stall_status} • {item.building_id}
                  </Text>
                  {item.tenant_id && (
                    <Text style={styles.rowSub}>Tenant: {item.tenant_id}</Text>
                  )}
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

      {}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalWrap}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              Edit Stall {editStall?.stall_id}
            </Text>
            {editStall && (
              <>
                <TextInput
                  style={styles.input}
                  value={editStall.stall_sn}
                  onChangeText={(v) =>
                    setEditStall({ ...editStall, stall_sn: v })
                  }
                />
                <Dropdown
                  label="Building"
                  value={editStall.building_id}
                  onChange={(v) =>
                    setEditStall({ ...editStall, building_id: v })
                  }
                  options={buildings.map((b) => ({
                    label: `${b.building_name} (${b.building_id})`,
                    value: b.building_id,
                  }))}
                />
                <Dropdown
                  label="Status"
                  value={editStall.stall_status}
                  onChange={(v) =>
                    setEditStall({
                      ...editStall,
                      stall_status: v as Stall["stall_status"],
                    })
                  }
                  options={[
                    { label: "Available", value: "available" },
                    { label: "Occupied", value: "occupied" },
                    { label: "Under Maintenance", value: "under maintenance" },
                  ]}
                />
                {editStall.stall_status !== "available" && (
                  <Dropdown
                    label="Tenant"
                    value={editStall.tenant_id ?? ""}
                    onChange={(v) =>
                      setEditStall({
                        ...editStall,
                        tenant_id: v || null,
                      })
                    }
                    options={[
                      { label: "None", value: "" },
                      ...tenants.map((t) => ({
                        label: `${t.tenant_name} (${t.tenant_id})`,
                        value: t.tenant_id,
                      })),
                    ]}
                  />
                )}
              </>
            )}
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

function Chip({
  label,
  active,
  onPress,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
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
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#102a43",
    marginBottom: 12,
  },
  rowWrap: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
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
  btnGhost: { backgroundColor: "#e6efff" },
  btnText: { color: "#fff", fontWeight: "700" },
  search: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
    marginBottom: 12,
  },

  chipsRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#fff",
  },
  chipActive: {
    backgroundColor: "#1f4bd8",
    borderColor: "#1f4bd8",
  },
  chipText: { color: "#102a43", fontWeight: "700" },
  chipTextActive: { color: "#fff" },

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
  dropdownLabel: {
    color: "#334e68ff",
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 6,
  },
  pickerWrapper: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 10,
    backgroundColor: "#fff",
  },
  picker: { height: 55, width: "100%" },

  filtersBar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "flex-end",
    gap: 12,
    padding: 12,
    marginBottom: 12,
    backgroundColor: "#f7f9ff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6efff",
  },
  filterCol: {
    flex: 1,
    minWidth: 220,
  },
  clearBtn: {
    alignSelf: "flex-end",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#d6e0ff",
  },
  clearBtnText: { color: "#1f4bd8", fontWeight: "700" },
});