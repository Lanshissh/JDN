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
  ScrollView,
} from "react-native";
import axios from "axios";
import { Picker } from "@react-native-picker/picker";
import { BASE_API } from "../../constants/api";

type Rate = {
  rate_id: string;
  erate_perKwH: number | null;
  e_vat: number | null;
  emin_con: number | null;
  wmin_con: number | null;
  wrate_perCbM: number | null;
  wnet_vat: number | null;
  w_vat: number | null;
  lrate_perKg: number | null;
  last_updated: string;
  updated_by: string;
};

/** helpers */
const cmp = (a: string | number, b: string | number) =>
  String(a ?? "").localeCompare(String(b ?? ""), undefined, {
    numeric: true,
    sensitivity: "base",
  });
const dateOf = (r: Rate) => Date.parse(r.last_updated || "") || 0;

export default function RatesPanel({ token }: { token: string | null }) {
  const [busy, setBusy] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rates, setRates] = useState<Rate[]>([]);
  const [query, setQuery] = useState("");

  // filters
  const [updatedByFilter, setUpdatedByFilter] = useState<string>("");
  type TypeFilter = "" | "electric" | "water" | "lpg";
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("");

  // sort chips
  type SortMode = "newest" | "oldest" | "idAsc" | "idDesc";
  const [sortMode, setSortMode] = useState<SortMode>("newest");

  // create form
  const [erate, setErate] = useState("");
  const [eVat, setEVat] = useState("");
  const [emin, setEmin] = useState("");
  const [wmin, setWmin] = useState("");
  const [wrate, setWrate] = useState("");
  const [wnetVat, setWnetVat] = useState("");
  const [wVat, setWVat] = useState("");
  const [lRate, setLRate] = useState("");

  // edit modal
  const [editVisible, setEditVisible] = useState(false);
  const [editRate, setEditRate] = useState<Rate | null>(null);

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
      Alert.alert("Not logged in", "Please log in as admin to manage rates.");
      return;
    }
    try {
      setBusy(true);
      const res = await api.get<Rate[]>("/rates");
      setRates(res.data);
    } catch (err: any) {
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

  /** build dropdown options */
  const updatedByOptions = useMemo(() => {
    const unique = Array.from(
      new Set(rates.map((r) => r.updated_by).filter(Boolean)),
    ).sort((a, b) => a.localeCompare(b));
    return [{ label: "All Users", value: "" }, ...unique.map((u) => ({ label: u, value: u }))];
  }, [rates]);

  /** Filters → Search */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = rates;

    // type filter
    if (typeFilter) {
      list = list.filter((r) => {
        switch (typeFilter) {
          case "electric":
            return (
              r.erate_perKwH != null ||
              r.e_vat != null ||
              r.emin_con != null
            );
          case "water":
            return (
              r.wrate_perCbM != null ||
              r.wnet_vat != null ||
              r.w_vat != null ||
              r.wmin_con != null
            );
          case "lpg":
            return r.lrate_perKg != null;
          default:
            return true;
        }
      });
    }

    // updated_by filter
    if (updatedByFilter) {
      list = list.filter((r) => (r.updated_by || "") === updatedByFilter);
    }

    // text search
    if (!q) return list;
    return list.filter((r) => r.rate_id.toLowerCase().includes(q));
  }, [rates, query, typeFilter, updatedByFilter]);

  /** Sort via chips */
  const sorted = useMemo(() => {
    const arr = [...filtered];
    switch (sortMode) {
      case "newest":
        return arr.sort((a, b) => dateOf(b) - dateOf(a));
      case "oldest":
        return arr.sort((a, b) => dateOf(a) - dateOf(b));
      case "idAsc":
        return arr.sort((a, b) => cmp(a.rate_id, b.rate_id));
      case "idDesc":
        return arr.sort((a, b) => cmp(b.rate_id, a.rate_id));
      default:
        return arr;
    }
  }, [filtered, sortMode]);

  const onCreate = async () => {
    if (!erate || !eVat || !emin || !wmin || !wrate || !wnetVat || !wVat || !lRate) {
      Alert.alert("Missing info", "Please fill in all fields.");
      return;
    }
    try {
      setSubmitting(true);
      await api.post("/rates", {
        erate_perKwH: parseFloat(erate),
        e_vat: parseFloat(eVat),
        emin_con: parseFloat(emin),
        wmin_con: parseFloat(wmin),
        wrate_perCbM: parseFloat(wrate),
        wnet_vat: parseFloat(wnetVat),
        w_vat: parseFloat(wVat),
        lrate_perKg: parseFloat(lRate),
      });
      setErate("");
      setEVat("");
      setEmin("");
      setWmin("");
      setWrate("");
      setWnetVat("");
      setWVat("");
      setLRate("");
      await loadAll();
      Alert.alert("Success", "Rate created.");
    } catch (err: any) {
      Alert.alert("Create failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  const openEdit = (r: Rate) => {
    setEditRate({ ...r });
    setEditVisible(true);
  };

  const onUpdate = async () => {
    if (!editRate) return;
    try {
      setSubmitting(true);
      await api.put(`/rates/${encodeURIComponent(editRate.rate_id)}`, {
        erate_perKwH: editRate.erate_perKwH,
        e_vat: editRate.e_vat,
        emin_con: editRate.emin_con,
        wmin_con: editRate.wmin_con,
        wrate_perCbM: editRate.wrate_perCbM,
        wnet_vat: editRate.wnet_vat,
        w_vat: editRate.w_vat,
        lrate_perKg: editRate.lrate_perKg,
      });
      setEditVisible(false);
      await loadAll();
      Alert.alert("Updated", "Rate updated successfully.");
    } catch (err: any) {
      Alert.alert("Update failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = (r: Rate) =>
    Platform.OS === "web"
      ? Promise.resolve(window.confirm(`Delete rate ${r.rate_id}?`))
      : new Promise((resolve) => {
          Alert.alert("Delete rate", `Are you sure you want to delete ${r.rate_id}?`, [
            { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
            { text: "Delete", style: "destructive", onPress: () => resolve(true) },
          ]);
        });

  const onDelete = async (r: Rate) => {
    const ok = await confirmDelete(r);
    if (!ok) return;
    try {
      setSubmitting(true);
      await api.delete(`/rates/${encodeURIComponent(r.rate_id)}`);
      await loadAll();
      if (Platform.OS !== "web") Alert.alert("Deleted", "Rate removed.");
    } catch (err: any) {
      Alert.alert("Delete failed", err?.response?.data?.error ?? "Server error.");
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dt: string) => {
    const d = new Date(dt);
    return isNaN(d.getTime())
      ? ""
      : d.toLocaleString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  return (
    <View style={styles.grid}>
      {/* Create Rate */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Utility Rate</Text>
        <LabeledInput label="Electric Rate per KwH" value={erate} setValue={setErate} />
        <LabeledInput label="Electric VAT" value={eVat} setValue={setEVat} />
        <LabeledInput label="Electric Min Consumption" value={emin} setValue={setEmin} />
        <LabeledInput label="Water Min Consumption" value={wmin} setValue={setWmin} />
        <LabeledInput label="Water Rate per CbM" value={wrate} setValue={setWrate} />
        <LabeledInput label="Water Net VAT" value={wnetVat} setValue={setWnetVat} />
        <LabeledInput label="Water VAT" value={wVat} setValue={setWVat} />
        <LabeledInput label="LPG Rate per Kg" value={lRate} setValue={setLRate} />
        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={onCreate}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Create Rate</Text>}
        </TouchableOpacity>
      </View>

      {/* Manage Rates */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manage Rates</Text>

        {/* Search */}
        <TextInput
          style={styles.search}
          placeholder="Search by ID…"
          value={query}
          onChangeText={setQuery}
        />

        {/* Filters */}
        <View style={styles.filtersBar}>
          <View style={styles.filterCol}>
            <Dropdown
              label="Filter by Updated By"
              value={updatedByFilter}
              onChange={setUpdatedByFilter}
              options={updatedByOptions}
            />
          </View>
          <View style={styles.filterCol}>
          </View>
          {(!!updatedByFilter || !!typeFilter) && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setUpdatedByFilter("");
                setTypeFilter("");
              }}
            >
              <Text style={styles.clearBtnText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        {/* Sort chips */}
        <View style={styles.chipsRow}>
          <Chip label="Newest" active={sortMode === "newest"} onPress={() => setSortMode("newest")} />
          <Chip label="Oldest" active={sortMode === "oldest"} onPress={() => setSortMode("oldest")} />
          <Chip label="ID ↑" active={sortMode === "idAsc"} onPress={() => setSortMode("idAsc")} />
          <Chip label="ID ↓" active={sortMode === "idDesc"} onPress={() => setSortMode("idDesc")} />
        </View>

        {busy ? (
          <View style={styles.loader}>
            <ActivityIndicator />
          </View>
        ) : (
          <FlatList
            data={sorted}
            keyExtractor={(item) => item.rate_id}
            ListEmptyComponent={<Text style={styles.empty}>No rates found.</Text>}
            renderItem={({ item }) => (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{item.rate_id}</Text>
                  <Text style={styles.rowSub}>
                    Elec: {item.erate_perKwH ?? "-"} • Water: {item.wrate_perCbM ?? "-"} • LPG:{" "}
                    {item.lrate_perKg ?? "-"}
                  </Text>
                  <Text style={styles.rowSub}>
                    Last Updated: {formatDate(item.last_updated)} • By: {item.updated_by}
                  </Text>
                </View>
                <TouchableOpacity style={styles.link} onPress={() => openEdit(item)}>
                  <Text style={styles.linkText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.link, { marginLeft: 8 }]} onPress={() => onDelete(item)}>
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
            <ScrollView>
              <Text style={styles.modalTitle}>Edit Rate {editRate?.rate_id}</Text>
              {editRate && (
                <>
                  <LabeledInput
                    label="Electric Rate per KwH"
                    value={editRate.erate_perKwH != null ? String(editRate.erate_perKwH) : ""}
                    setValue={(v) => setEditRate({ ...editRate, erate_perKwH: parseFloat(v) })}
                  />
                  <LabeledInput
                    label="Electric VAT"
                    value={editRate.e_vat != null ? String(editRate.e_vat) : ""}
                    setValue={(v) => setEditRate({ ...editRate, e_vat: parseFloat(v) })}
                  />
                  <LabeledInput
                    label="Electric Min Consumption"
                    value={editRate.emin_con != null ? String(editRate.emin_con) : ""}
                    setValue={(v) => setEditRate({ ...editRate, emin_con: parseFloat(v) })}
                  />
                  <LabeledInput
                    label="Water Min Consumption"
                    value={editRate.wmin_con != null ? String(editRate.wmin_con) : ""}
                    setValue={(v) => setEditRate({ ...editRate, wmin_con: parseFloat(v) })}
                  />
                  <LabeledInput
                    label="Water Rate per CbM"
                    value={editRate.wrate_perCbM != null ? String(editRate.wrate_perCbM) : ""}
                    setValue={(v) => setEditRate({ ...editRate, wrate_perCbM: parseFloat(v) })}
                  />
                  <LabeledInput
                    label="Water Net VAT"
                    value={editRate.wnet_vat != null ? String(editRate.wnet_vat) : ""}
                    setValue={(v) => setEditRate({ ...editRate, wnet_vat: parseFloat(v) })}
                  />
                  <LabeledInput
                    label="Water VAT"
                    value={editRate.w_vat != null ? String(editRate.w_vat) : ""}
                    setValue={(v) => setEditRate({ ...editRate, w_vat: parseFloat(v) })}
                  />
                  <LabeledInput
                    label="LPG Rate per Kg"
                    value={editRate.lrate_perKg != null ? String(editRate.lrate_perKg) : ""}
                    setValue={(v) => setEditRate({ ...editRate, lrate_perKg: parseFloat(v) })}
                  />
                  <Text style={styles.readonlyLabel}>Last Updated</Text>
                  <TextInput style={styles.input} value={formatDate(editRate.last_updated)} editable={false} />
                  <Text style={styles.readonlyLabel}>Updated By</Text>
                  <TextInput style={styles.input} value={editRate.updated_by ?? ""} editable={false} />
                </>
              )}
              <View style={styles.modalActions}>
                <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setEditVisible(false)}>
                  <Text style={[styles.btnText, { color: "#102a43" }]}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.btn} onPress={onUpdate} disabled={submitting}>
                  {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Save changes</Text>}
                </TouchableOpacity>
              </View>
            </ScrollView>
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
    <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
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
    <View style={{ marginTop: 8, flex: 1 }}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <View style={styles.pickerWrapper}>
        <Picker selectedValue={value} onValueChange={(val) => onChange(String(val))} style={styles.picker}>
          {options.map((opt) => (
            <Picker.Item key={opt.value} label={opt.label} value={opt.value} />
          ))}
        </Picker>
      </View>
    </View>
  );
}

function LabeledInput({
  label,
  value,
  setValue,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput style={styles.input} value={value} onChangeText={setValue} keyboardType="numeric" />
    </>
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
  label: { fontWeight: "600", color: "#334e68", marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    color: "#102a43",
    marginTop: 4,
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

  /** filter bar */
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
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#d6e0ff",
  },
  clearBtnText: { color: "#1f4bd8", fontWeight: "700" },

  search: {
    borderWidth: 1,
    borderColor: "#d9e2ec",
    backgroundColor: "#fff",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 12,
  },

  /** chips */
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
    maxHeight: "90%",
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
    marginBottom: 20,
  },

  /** dropdown bits */
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
    height: 55,
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  picker: { height: 55, width: "100%" },
  readonlyLabel: { fontWeight: "600", color: "#999", marginTop: 8 },
});