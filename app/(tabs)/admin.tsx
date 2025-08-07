import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ActivityIndicator,
  Modal,
  Platform,
  Dimensions,
  Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Picker } from "@react-native-picker/picker";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

type AdminSection =
  | "qr"
  | "create"
  | "manage"
  | "rate"
  | "buildings"
  | "stalls"
  | "tenants"
  | null;

type Building = {
  building_id: string;
  building_name: string;
  rate_id: string;
  last_updated?: string;
  updated_by?: string;
};

type AddRateFields = {
  erate_perKwH: string;
  e_vat: string;
  emin_con: string;
  wmin_con: string;
  wrate_perCbM: string;
  wnet_vat: string;
  w_vat: string;
  l_rate: string;
  [key: string]: string;
};

const API_USERS_URL = "http://192.168.100.11:3000/users";
const API_BUILDINGS_URL = "http://192.168.100.11:3000/buildings";
const API_RATES_URL = "http://192.168.100.11:3000/rates";
const API_STALLS_URL = "http://192.168.100.11:3000/stalls";
const API_TENANTS_URL = "http://192.168.100.11:3000/tenants";

export default function AdminScreen() {
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "employee">("employee");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("");
  const [buildingList, setBuildingList] = useState<
    { building_id: string; building_name: string }[]
  >([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState("");
  const [text, setText] = useState("");
  const [generated, setGenerated] = useState("");
  const qrRef = useRef<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "employee">("employee");
  const [editBuilding, setEditBuilding] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [activeTab, setActiveTab] = useState<AdminSection>(null);
  const SCREEN_WIDTH = Dimensions.get("window").width;
  const [drawerAnim] = useState(new Animated.Value(-SCREEN_WIDTH * 0.75));

  // Hamburger menu state for mobile
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [mobileSection, setMobileSection] = useState<AdminSection>(null);

  // Utility Rate states
  const [rates, setRates] = useState<any[]>([]);
  const [rateLoading, setRateLoading] = useState(false);
  const [showAddRate, setShowAddRate] = useState(false);
  const [addRateFields, setAddRateFields] = useState<AddRateFields>({
    erate_perKwH: "",
    e_vat: "",
    emin_con: "",
    wmin_con: "",
    wrate_perCbM: "",
    wnet_vat: "",
    w_vat: "",
    l_rate: "",
  });

  // For editing rates
  const [editRateModal, setEditRateModal] = useState(false);
  const [editRateFields, setEditRateFields] = useState<AddRateFields>({
    erate_perKwH: "",
    e_vat: "",
    emin_con: "",
    wmin_con: "",
    wrate_perCbM: "",
    wnet_vat: "",
    w_vat: "",
    l_rate: "",
  });
  const [editingRateId, setEditingRateId] = useState<string | null>(null);

  //For stalls
  const [stallList, setStallList] = useState<any[]>([]);
  const [stallsLoading, setStallsLoading] = useState(false);
  const [showStallModal, setShowStallModal] = useState(false);
  const [editingStall, setEditingStall] = useState<any>(null);

  // State for tenants
  const [tenantList, setTenantList] = useState<any[]>([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [showTenantModal, setShowTenantModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);

  const [stallFields, setStallFields] = useState({
    stall_sn: "",
    tenant_id: "",
    building_id: "",
    stall_status: "available",
  });

  const [tenantFields, setTenantFields] = useState({
    tenant_sn: "",
    tenant_name: "",
    building_id: "",
    bill_start: "",
  });

  const router = useRouter();

  const handleLogout = async () => {
    await AsyncStorage.removeItem("token");
    router.replace("/login");
  };

  const openDrawer = () => {
    setShowMobileMenu(true);
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  };
  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: -SCREEN_WIDTH * 0.75,
      duration: 180,
      useNativeDriver: false,
    }).start(() => setShowMobileMenu(false));
  };

  // Add below your other states
  const [buildingListFull, setBuildingListFull] = useState<Building[]>([]);
  const [buildingsLoadingFull, setBuildingsLoadingFull] = useState(false);

  const [showBuildingModal, setShowBuildingModal] = useState(false);
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  const [buildingFields, setBuildingFields] = useState({
    building_name: "",
    rate_id: "",
  });

  // Fetch simple building list for user creation picker
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(API_BUILDINGS_URL, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          setBuildingList(data);
          if (data.length > 0) setSelectedBuildingId(data[0].building_id);
        } else {
          setBuildingList([]);
          setSelectedBuildingId("");
        }
      } catch (err) {
        setBuildingList([]);
        setSelectedBuildingId("");
      }
      setBuildingsLoading(false);
    };
    fetchBuildings();
  }, []);
  // --- Fetch full buildings for CRUD section ---
  const fetchBuildingsFull = async () => {
    setBuildingsLoadingFull(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(API_BUILDINGS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setBuildingListFull(res.ok ? data : []);
    } catch (err) {
      setBuildingListFull([]);
    }
    setBuildingsLoadingFull(false);
  };
  useEffect(() => {
    fetchBuildingsFull();
  }, []);

  // Fetch users
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(API_USERS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) setUsers(data);
      else setUsers([]);
    } catch {
      setUsers([]);
    }
    setUsersLoading(false);
  };

  useEffect(() => {
    if (
      (Platform.OS === "web" && activeTab === "manage") ||
      (Platform.OS !== "web" && mobileSection === "manage")
    ) {
      fetchUsers();
    }
  }, [activeTab, mobileSection]);

  // --- Fetch utility rates ---
  useEffect(() => {
    if (
      (Platform.OS === "web" && activeTab === "rate") ||
      (Platform.OS !== "web" && mobileSection === "rate")
    ) {
      fetchRates();
    }
  }, [activeTab, mobileSection]);

  const fetchRates = async () => {
    setRateLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(API_RATES_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRates(res.ok ? data : []);
    } catch {
      setRates([]);
    }
    setRateLoading(false);
  };

  // Edit Utility Rate Modal Logic
  const openEditRateModal = (rate: any) => {
    setEditingRateId(rate.rate_id);
    setEditRateFields({
      erate_perKwH: String(rate.erate_perKwH ?? ""),
      e_vat: String(rate.e_vat ?? ""),
      emin_con: String(rate.emin_con ?? ""),
      wmin_con: String(rate.wmin_con ?? ""),
      wrate_perCbM: String(rate.wrate_perCbM ?? ""),
      wnet_vat: String(rate.wnet_vat ?? ""),
      w_vat: String(rate.w_vat ?? ""),
      l_rate: String(rate.l_rate ?? ""),
    });
    setEditRateModal(true);
  };

  const handleEditRate = async () => {
    if (!editingRateId) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(`${API_RATES_URL}/${editingRateId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...editRateFields,
          erate_perKwH: parseFloat(editRateFields.erate_perKwH),
          e_vat: parseFloat(editRateFields.e_vat),
          emin_con: parseFloat(editRateFields.emin_con),
          wmin_con: parseFloat(editRateFields.wmin_con),
          wrate_perCbM: parseFloat(editRateFields.wrate_perCbM),
          wnet_vat: parseFloat(editRateFields.wnet_vat),
          w_vat: parseFloat(editRateFields.w_vat),
          l_rate: parseFloat(editRateFields.l_rate),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert("Success", data.message || "Rate updated.");
        setEditRateModal(false);
        fetchRates();
      } else {
        Alert.alert("Error", data?.error || "Server error");
      }
    } catch {
      Alert.alert("Error", "Network or server error");
    }
  };

  const handleDeleteRate = (rate_id: string) => {
    const doDelete = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(`${API_RATES_URL}/${rate_id}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (res.ok) {
          Alert.alert("Deleted", data.message || "Rate deleted.");
          fetchRates();
        } else {
          Alert.alert("Error", data?.error || "Server error");
        }
      } catch {
        Alert.alert("Error", "Network or server error");
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm(`Are you sure you want to delete rate ${rate_id}?`))
        doDelete();
    } else {
      Alert.alert(
        "Delete Rate",
        `Are you sure you want to delete rate ${rate_id}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Delete", style: "destructive", onPress: doDelete },
        ],
      );
    }
  };

  const filteredUsers = users.filter((user) => {
    const val = filter.trim().toLowerCase();
    if (!val) return true;
    return (
      user.user_id?.toLowerCase().includes(val) ||
      user.user_fullname?.toLowerCase().includes(val) ||
      user.user_level?.toLowerCase().includes(val) ||
      user.building_id?.toLowerCase().includes(val)
    );
  });

  const assignedTenantIds = stallList
    .filter((stall) => stall.tenant_id)
    .map((stall) => stall.tenant_id);
  const availableTenants = tenantList.filter(
    (t) =>
      !assignedTenantIds.includes(t.tenant_id) ||
      t.tenant_id === stallFields.tenant_id,
  );

  // Create account
  const handleRegister = async () => {
    if (!newUsername || !newPassword || !selectedBuildingId) {
      return Alert.alert(
        "Missing Fields",
        "Please enter username, password, and select a building.",
      );
    }
    const validBuilding = buildingList.some(
      (b) => b.building_id === selectedBuildingId,
    );
    if (!validBuilding) {
      return Alert.alert(
        "Invalid Building",
        `Building ID "${selectedBuildingId}" does not exist.`,
      );
    }
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(API_USERS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          user_password: newPassword,
          user_fullname: newUsername,
          user_level: newRole,
          building_id: selectedBuildingId,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unknown server error");
      }
      Alert.alert("Success", `Account created. User ID: ${data.userId}`);
      setNewUsername("");
      setNewPassword("");
      setSelectedBuildingId(buildingList[0]?.building_id || "");
      if (
        Platform.OS === "web"
          ? activeTab === "manage"
          : mobileSection === "manage"
      )
        fetchUsers();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not create user");
    }
  };

  // Delete user from API and refresh list
  const handleDeleteUser = (user_id: string) => {
    Alert.alert("Delete Account", `Remove user "${user_id}"?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            const res = await fetch(`${API_USERS_URL}/${user_id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Could not delete user");
            Alert.alert("Deleted", `User ${user_id} deleted successfully.`);
            fetchUsers();
          } catch (err: any) {
            Alert.alert("Error", err?.message || "Could not delete user");
          }
        },
      },
    ]);
  };

  // Edit user modal handlers
  const openEditModal = (user: any) => {
    setEditUser(user);
    setEditName(user.user_fullname);
    setEditRole(user.user_level);
    setEditBuilding(user.building_id);
    setEditPassword("");
    setEditModalVisible(true);
  };
  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditUser(null);
  };
  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const updatedData: any = {
        user_fullname: editName,
        user_level: editRole,
        building_id: editBuilding,
      };
      if (editPassword) updatedData.user_password = editPassword;

      const res = await fetch(`${API_USERS_URL}/${editUser.user_id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updatedData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not update user");
      Alert.alert("Updated", `User ${editUser.user_id} updated successfully.`);
      closeEditModal();
      fetchUsers();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Could not update user");
    }
  };

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL?.(async (dataURL: string) => {
      if (Platform.OS === "web") {
        const qrSize = 200;
        const inchToPx = 96;
        const marginPx = 0.2 * inchToPx;
        const canvasSize = qrSize + 2 * marginPx;

        const canvas = document.createElement("canvas");
        canvas.width = canvasSize;
        canvas.height = canvasSize;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvasSize, canvasSize);

        const img = new window.Image();
        img.onload = () => {
          ctx.drawImage(img, marginPx, marginPx, qrSize, qrSize);

          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = "qr-code.png";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        };
        img.src = "data:image/png;base64," + dataURL;
      } else {
        const uri = FileSystem.cacheDirectory + "qr-code.png";
        await FileSystem.writeAsStringAsync(uri, dataURL, {
          encoding: FileSystem.EncodingType.Base64,
        });
        await Sharing.shareAsync(uri);
      }
    });
  };
  const fetchStalls = async () => {
    setStallsLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(API_STALLS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setStallList(res.ok ? data : []);
    } catch {
      setStallList([]);
    }
    setStallsLoading(false);
  };

  useEffect(() => {
    // fetch on mount and when needed
    if (
      (Platform.OS === "web" && activeTab === "stalls") ||
      (Platform.OS !== "web" && mobileSection === "stalls")
    ) {
      fetchStalls();
    }
  }, [activeTab, mobileSection]);

  const openAddStallModal = () => {
    setEditingStall(null);
    setStallFields({
      stall_sn: "",
      tenant_id: "",
      building_id: "",
      stall_status: "available",
    });
    setShowStallModal(true);
  };
  const openEditStallModal = (stall: any) => {
    setEditingStall(stall);
    setStallFields({
      stall_sn: stall.stall_sn,
      tenant_id: stall.tenant_id || "",
      building_id: stall.building_id,
      stall_status: stall.stall_status,
    });
    setShowStallModal(true);
  };
  const closeStallModal = () => {
    setShowStallModal(false);
    setEditingStall(null);
    setStallFields({
      stall_sn: "",
      tenant_id: "",
      building_id: "",
      stall_status: "available",
    });
  };

  const handleSaveStall = async () => {
    if (
      !stallFields.stall_sn ||
      !stallFields.building_id ||
      !stallFields.stall_status
    ) {
      alert("All fields except tenant are required.");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("token");
      const method = editingStall ? "PUT" : "POST";
      const url = editingStall
        ? `${API_STALLS_URL}/${editingStall.stall_id}`
        : API_STALLS_URL;
      console.log("Posting to:", url, "with:", stallFields);
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(stallFields),
      });
      const data = await res.json();
      console.log("Stall response:", data, res.status);
      if (res.ok) {
        alert(editingStall ? "Stall updated!" : "Stall created!");
        closeStallModal();
        fetchStalls();
      } else {
        alert("Error: " + (data?.error || "Server error"));
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      alert("Error: " + msg);
      console.log(e);
    }
  };

  const handleDeleteStall = (stall_id: string) => {
    if (Platform.OS === "web") {
      if (window.confirm(`Delete stall ${stall_id}?`)) {
        (async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            const res = await fetch(`${API_STALLS_URL}/${stall_id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
              alert("Deleted: " + (data.message || "Stall deleted."));
              fetchStalls();
            } else {
              alert("Error: " + (data?.error || "Server error"));
            }
          } catch (e) {
            alert("Error: " + (e instanceof Error ? e.message : String(e)));
          }
        })();
      }
    } else {
      Alert.alert("Delete Stall", `Delete stall ${stall_id}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              const res = await fetch(`${API_STALLS_URL}/${stall_id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert("Deleted", data.message || "Stall deleted.");
                fetchStalls();
              } else {
                Alert.alert("Error", data?.error || "Server error");
              }
            } catch (e) {
              Alert.alert("Error", e instanceof Error ? e.message : String(e));
            }
          },
        },
      ]);
    }
  };

  const fetchTenants = async () => {
    setTenantsLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(API_TENANTS_URL, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setTenantList(res.ok ? data : []);
    } catch {
      setTenantList([]);
    }
    setTenantsLoading(false);
  };

  useEffect(() => {
    if (
      (Platform.OS === "web" && activeTab === "tenants") ||
      (Platform.OS !== "web" && mobileSection === "tenants")
    ) {
      fetchTenants();
    }
  }, [activeTab, mobileSection]);

  const openAddTenantModal = () => {
    setEditingTenant(null);
    setTenantFields({
      tenant_sn: "",
      tenant_name: "",
      building_id: "",
      bill_start: "",
    });
    setShowTenantModal(true);
  };
  const openEditTenantModal = (tenant: any) => {
    setEditingTenant(tenant);
    setTenantFields({
      tenant_sn: tenant.tenant_sn,
      tenant_name: tenant.tenant_name,
      building_id: tenant.building_id,
      bill_start: tenant.bill_start?.slice(0, 10) || "",
    });
    setShowTenantModal(true);
  };
  const closeTenantModal = () => {
    setShowTenantModal(false);
    setEditingTenant(null);
    setTenantFields({
      tenant_sn: "",
      tenant_name: "",
      building_id: "",
      bill_start: "",
    });
  };

  const handleSaveTenant = async () => {
    if (
      !tenantFields.tenant_sn ||
      !tenantFields.tenant_name ||
      !tenantFields.building_id ||
      !tenantFields.bill_start
    ) {
      Alert.alert("Required", "All fields are required.");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("token");
      const method = editingTenant ? "PUT" : "POST";
      const url = editingTenant
        ? `${API_TENANTS_URL}/${editingTenant.tenant_id}`
        : API_TENANTS_URL;
      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(tenantFields),
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert(
          editingTenant ? "Updated" : "Created",
          data.message || "Tenant saved.",
        );
        closeTenantModal();
        fetchTenants();
      } else {
        Alert.alert("Error", data?.error || "Server error");
      }
    } catch {
      Alert.alert("Error", "Network or server error");
    }
  };

  const handleDeleteTenant = (tenant_id: string) => {
    if (Platform.OS === "web") {
      if (window.confirm(`Delete tenant ${tenant_id}?`)) {
        (async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            const res = await fetch(`${API_TENANTS_URL}/${tenant_id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
              alert("Deleted: " + (data.message || "Tenant deleted."));
              fetchTenants();
            } else {
              alert("Error: " + (data?.error || "Server error"));
            }
          } catch (e) {
            alert("Error: " + (e instanceof Error ? e.message : String(e)));
          }
        })();
      }
    } else {
      // Mobile (already works)
      Alert.alert("Delete Tenant", `Delete tenant ${tenant_id}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              const res = await fetch(`${API_TENANTS_URL}/${tenant_id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert("Deleted", data.message || "Tenant deleted.");
                fetchTenants();
              } else {
                Alert.alert("Error", data?.error || "Server error");
              }
            } catch {
              Alert.alert("Error", "Network or server error");
            }
          },
        },
      ]);
    }
  };

  // Add CRUD handlers for Building
  const openAddBuildingModal = () => {
    setEditingBuilding(null);
    setBuildingFields({ building_name: "", rate_id: "" });
    setShowBuildingModal(true);
  };
  const openEditBuildingModal = (bldg: Building) => {
    setEditingBuilding(bldg);
    setBuildingFields({
      building_name: bldg.building_name,
      rate_id: bldg.rate_id,
    });
    setShowBuildingModal(true);
  };
  const closeBuildingModal = () => {
    setShowBuildingModal(false);
    setEditingBuilding(null);
    setBuildingFields({ building_name: "", rate_id: "" });
  };

  const handleSaveBuilding = async () => {
    if (!buildingFields.building_name || !buildingFields.rate_id) {
      Alert.alert("Required", "All fields are required.");
      return;
    }
    try {
      const token = await AsyncStorage.getItem("token");
      if (editingBuilding) {
        // UPDATE
        const res = await fetch(
          `${API_BUILDINGS_URL}/${editingBuilding.building_id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              building_name: buildingFields.building_name,
              rate_id: buildingFields.rate_id,
            }),
          },
        );
        const data = await res.json();
        if (res.ok) {
          Alert.alert("Updated", "Building updated.");
          closeBuildingModal();
          fetchBuildingsFull();
        } else {
          Alert.alert("Error", data?.error || "Server error");
        }
      } else {
        // CREATE
        const res = await fetch(API_BUILDINGS_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            building_name: buildingFields.building_name,
            rate_id: buildingFields.rate_id,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          Alert.alert("Created", "Building created.");
          closeBuildingModal();
          fetchBuildingsFull();
        } else {
          Alert.alert("Error", data?.error || "Server error");
        }
      }
    } catch {
      Alert.alert("Error", "Network or server error");
    }
  };

  const handleDeleteBuilding = (building_id: string) => {
    if (Platform.OS === "web") {
      if (window.confirm(`Delete building ${building_id}?`)) {
        (async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            const res = await fetch(`${API_BUILDINGS_URL}/${building_id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) {
              alert("Deleted: " + (data.message || "Building deleted."));
              fetchBuildingsFull();
            } else {
              alert("Error: " + (data?.error || "Server error"));
            }
          } catch (e) {
            alert("Error: " + (e instanceof Error ? e.message : String(e)));
          }
        })();
      }
    } else {
      // Use Alert for mobile
      Alert.alert("Delete Building", `Delete building ${building_id}?`, [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              const res = await fetch(`${API_BUILDINGS_URL}/${building_id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) {
                Alert.alert("Deleted", data.message || "Building deleted.");
                fetchBuildingsFull();
              } else {
                Alert.alert("Error", data?.error || "Server error");
              }
            } catch {
              Alert.alert("Error", "Network or server error");
            }
          },
        },
      ]);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* MOBILE HEADER WITH HAMBURGER NAV */}
      {Platform.OS !== "web" && (
        <View style={styles.headerMobile}>
          <TouchableOpacity style={styles.hamburgerBtn} onPress={openDrawer}>
            <Ionicons name="menu-outline" size={32} color="#333" />
          </TouchableOpacity>
          <View style={styles.logoCenterContainer}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <TouchableOpacity style={styles.logoutIconBtn} onPress={handleLogout}>
            <Ionicons name="log-out-outline" size={28} color="#d9534f" />
          </TouchableOpacity>
        </View>
      )}

      {/* --- MOBILE DRAWER --- */}
      <Modal
        visible={showMobileMenu}
        transparent
        animationType="none"
        onRequestClose={closeDrawer}
      >
        <View style={{ flex: 1, flexDirection: "row" }}>
          <Animated.View
            style={{
              width: "75%",
              maxWidth: 340,
              height: "100%",
              backgroundColor: "#fff",
              paddingHorizontal: 22,
              paddingTop: 38,
              justifyContent: "flex-start",
              transform: [{ translateX: drawerAnim }],
            }}
          >
            <Text
              style={{
                fontWeight: "bold",
                fontSize: 22,
                marginBottom: 30,
                marginLeft: 4,
              }}
            >
              Admin Menu
            </Text>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMobileSection("qr");
                closeDrawer();
              }}
            >
              <Ionicons
                name="qr-code-outline"
                size={24}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>QR Code Generator</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMobileSection("create");
                closeDrawer();
              }}
            >
              <Ionicons
                name="person-add-outline"
                size={24}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Create Account</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMobileSection("manage");
                closeDrawer();
              }}
            >
              <Ionicons
                name="people-outline"
                size={24}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Manage Accounts</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMobileSection("rate");
                closeDrawer();
              }}
            >
              <Ionicons
                name="calculator-outline"
                size={24}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Utility Rate</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMobileSection("buildings");
                closeDrawer();
              }}
            >
              <Ionicons
                name="business-outline"
                size={24}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Buildings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMobileSection("stalls");
                closeDrawer();
              }}
            >
              <Ionicons
                name="storefront-outline"
                size={24}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Stalls</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => {
                setMobileSection("tenants");
                closeDrawer();
              }}
            >
              <Ionicons
                name="people-circle-outline"
                size={24}
                style={styles.menuIcon}
              />
              <Text style={styles.menuText}>Tenants</Text>
            </TouchableOpacity>
          </Animated.View>
          <TouchableOpacity
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)" }}
            activeOpacity={1}
            onPress={closeDrawer}
          />
        </View>
      </Modal>

      {/* MOBILE: Feature content (one at a time, chosen from hamburger nav) */}
      {Platform.OS !== "web" && (
        <>
          {/* QR GENERATOR */}
          {mobileSection === "qr" && (
            <View style={styles.dropdownContent}>
              <TextInput
                style={styles.input}
                placeholder="Text for QR"
                value={text}
                onChangeText={(val) => {
                  setText(val);
                  setGenerated(val);
                }}
              />
              <View style={styles.qrContainer}>
                {generated ? (
                  <>
                    <QRCode
                      value={generated}
                      size={200}
                      getRef={(c) => (qrRef.current = c)}
                    />
                    <TouchableOpacity
                      style={styles.downloadBtn}
                      onPress={handleDownloadQR}
                    >
                      <Ionicons
                        name="download-outline"
                        size={20}
                        color="#fff"
                      />
                      <Text style={styles.downloadBtnText}>Download QR</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <Text style={styles.placeholder}>QR Preview</Text>
                )}
              </View>
            </View>
          )}

          {/* CREATE ACCOUNT */}
          {mobileSection === "create" && (
            <View style={styles.dropdownContent}>
              <TextInput
                style={styles.input}
                placeholder="User Full Name"
                value={newUsername}
                onChangeText={setNewUsername}
              />
              <TextInput
                style={styles.input}
                placeholder="Password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              {/* Role dropdown */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ marginBottom: 6, fontWeight: "500" }}>
                  Role:
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  <Picker
                    selectedValue={newRole}
                    onValueChange={(itemValue) =>
                      setNewRole(itemValue as "admin" | "employee")
                    }
                    style={{ height: 50, width: "100%" }}
                  >
                    <Picker.Item label="Employee" value="employee" />
                    <Picker.Item label="Admin" value="admin" />
                  </Picker>
                </View>
              </View>
              {/* Building dropdown */}
              <View style={{ marginBottom: 10 }}>
                <Text style={{ marginBottom: 6, fontWeight: "500" }}>
                  Building:
                </Text>
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  {buildingsLoading ? (
                    <Text style={{ padding: 12 }}>Loading buildings...</Text>
                  ) : (
                    <Picker
                      selectedValue={selectedBuildingId}
                      onValueChange={(itemValue) =>
                        setSelectedBuildingId(itemValue)
                      }
                      style={{ height: 50, width: "100%" }}
                    >
                      {buildingList.map((b) => (
                        <Picker.Item
                          key={b.building_id}
                          label={`${b.building_id} - ${b.building_name}`}
                          value={b.building_id}
                        />
                      ))}
                    </Picker>
                  )}
                </View>
              </View>
              <TouchableOpacity style={styles.button} onPress={handleRegister}>
                <Text style={styles.buttonText}>Create Account</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* MANAGE ACCOUNTS */}
          {mobileSection === "manage" && (
            <View style={styles.dropdownContent}>
              <TextInput
                style={styles.input}
                placeholder="Search user_id, name, role, building"
                value={filter}
                onChangeText={setFilter}
              />
              {usersLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#007bff"
                  style={{ margin: 12 }}
                />
              ) : filteredUsers.length === 0 ? (
                <Text style={styles.placeholder}>No accounts found.</Text>
              ) : (
                filteredUsers.map((user) => (
                  <View key={user.user_id} style={styles.userRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: "bold" }}>{user.user_id}</Text>
                      <Text>Name: {user.user_fullname}</Text>
                      <Text>Role: {user.user_level}</Text>
                      <Text>Building: {user.building_id}</Text>
                    </View>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 10,
                      }}
                    >
                      <TouchableOpacity onPress={() => openEditModal(user)}>
                        <Ionicons
                          name="pencil-outline"
                          size={22}
                          color="#007bff"
                        />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => handleDeleteUser(user.user_id)}
                      >
                        <Ionicons name="trash-outline" size={22} color="red" />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>
          )}

          {/* UTILITY RATE (Mobile) */}
          {mobileSection === "rate" && (
            <View style={styles.dropdownContent}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text
                  style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}
                >
                  Utility Rates
                </Text>
                <TouchableOpacity
                  style={{
                    backgroundColor: "#007bff",
                    borderRadius: 8,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    flexDirection: "row",
                    alignItems: "center",
                  }}
                  onPress={() => setShowAddRate(!showAddRate)}
                >
                  <Ionicons
                    name={showAddRate ? "close" : "add-circle-outline"}
                    size={20}
                    color="#fff"
                  />
                  <Text
                    style={{
                      color: "#fff",
                      marginLeft: 6,
                      fontWeight: "bold",
                      fontSize: 15,
                    }}
                  >
                    {showAddRate ? "Cancel" : "Add Rate"}
                  </Text>
                </TouchableOpacity>
              </View>
              {/* Add Rate Form */}
              {showAddRate && (
                <View style={{ marginBottom: 12 }}>
                  {[
                    { key: "erate_perKwH", label: "Electric Rate (per kWh)" },
                    { key: "e_vat", label: "Electric VAT" },
                    { key: "emin_con", label: "Electric Min Consumption" },
                    { key: "wmin_con", label: "Water Min Consumption" },
                    { key: "wrate_perCbM", label: "Water Rate (per m³)" },
                    { key: "wnet_vat", label: "Water Net VAT" },
                    { key: "w_vat", label: "Water VAT" },
                    { key: "l_rate", label: "LPG Rate" },
                  ].map((f) => (
                    <TextInput
                      key={f.key}
                      style={styles.input}
                      placeholder={f.label}
                      value={addRateFields[f.key]}
                      keyboardType="numeric"
                      onChangeText={(v) =>
                        setAddRateFields((r) => ({ ...r, [f.key]: v }))
                      }
                    />
                  ))}
                  <TouchableOpacity
                    style={[styles.button, { backgroundColor: "#007bff" }]}
                    onPress={async () => {
                      for (let k in addRateFields) {
                        if (!addRateFields[k]) {
                          Alert.alert("Required", "All fields are required.");
                          return;
                        }
                      }
                      try {
                        const token = await AsyncStorage.getItem("token");
                        const res = await fetch(API_RATES_URL, {
                          method: "POST",
                          headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${token}`,
                          },
                          body: JSON.stringify({
                            ...addRateFields,
                            erate_perKwH: parseFloat(
                              addRateFields.erate_perKwH,
                            ),
                            e_vat: parseFloat(addRateFields.e_vat),
                            emin_con: parseFloat(addRateFields.emin_con),
                            wmin_con: parseFloat(addRateFields.wmin_con),
                            wrate_perCbM: parseFloat(
                              addRateFields.wrate_perCbM,
                            ),
                            wnet_vat: parseFloat(addRateFields.wnet_vat),
                            w_vat: parseFloat(addRateFields.w_vat),
                            l_rate: parseFloat(addRateFields.l_rate),
                          }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          Alert.alert("Success", "Rate added.");
                          setAddRateFields({
                            erate_perKwH: "",
                            e_vat: "",
                            emin_con: "",
                            wmin_con: "",
                            wrate_perCbM: "",
                            wnet_vat: "",
                            w_vat: "",
                            l_rate: "",
                          });
                          setShowAddRate(false);
                          fetchRates();
                        } else {
                          Alert.alert("Error", data?.error || "Server error");
                        }
                      } catch {
                        Alert.alert("Error", "Network or server error");
                      }
                    }}
                  >
                    <Text style={styles.buttonText}>Add Rate</Text>
                  </TouchableOpacity>
                </View>
              )}
              {/* Rate List */}
              {rateLoading ? (
                <ActivityIndicator
                  size="small"
                  color="#007bff"
                  style={{ margin: 12 }}
                />
              ) : rates.length === 0 ? (
                <Text style={styles.placeholder}>No utility rates found.</Text>
              ) : (
                <View>
                  {rates.map((rate) => (
                    <View
                      key={rate.rate_id}
                      style={{
                        padding: 10,
                        borderBottomColor: "#ccc",
                        borderBottomWidth: 1,
                        flexDirection: "row",
                        alignItems: "center",
                      }}
                    >
                      {/* Left: rate info */}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: "bold" }}>
                          <Text>ID: {rate.rate_id}</Text>
                        </Text>
                        <Text>
                          Electric: {rate.erate_perKwH} / VAT: {rate.e_vat}
                        </Text>
                        <Text>
                          Min: {rate.emin_con} / Water: {rate.wrate_perCbM}
                        </Text>
                        <Text>
                          VAT: {rate.w_vat} / Net VAT: {rate.wnet_vat}
                        </Text>
                        <Text>
                          {" "}
                          Min: {rate.wmin_con} / LPG: {rate.l_rate}
                        </Text>
                      </View>
                      {/* Right: Edit/Delete icons */}
                      <View
                        style={{ flexDirection: "row", alignItems: "center" }}
                      >
                        <TouchableOpacity
                          onPress={() => openEditRateModal(rate)}
                          style={{ padding: 10 }}
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={22}
                            color="#007bff"
                          />
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => handleDeleteRate(rate.rate_id)}
                          style={{ padding: 10 }}
                        >
                          <Ionicons
                            name="trash-outline"
                            size={22}
                            color="red"
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))}
                </View>
              )}
              {/* Edit Rate Modal (Same as web) */}
              <Modal
                visible={editRateModal}
                animationType="slide"
                transparent
                onRequestClose={() => setEditRateModal(false)}
              >
                <View style={styles.modalOverlay}>
                  <View style={styles.modalContainer}>
                    <Text
                      style={{
                        fontWeight: "bold",
                        fontSize: 18,
                        marginBottom: 10,
                      }}
                    >
                      Edit Utility Rate
                    </Text>
                    {[
                      { key: "erate_perKwH", label: "Electric Rate (per kWh)" },
                      { key: "e_vat", label: "Electric VAT" },
                      { key: "emin_con", label: "Electric Min Consumption" },
                      { key: "wmin_con", label: "Water Min Consumption" },
                      { key: "wrate_perCbM", label: "Water Rate (per m³)" },
                      { key: "wnet_vat", label: "Water Net VAT" },
                      { key: "w_vat", label: "Water VAT" },
                      { key: "l_rate", label: "LPG Rate" },
                    ].map((f) => (
                      <TextInput
                        key={f.key}
                        style={styles.input}
                        placeholder={f.label}
                        value={editRateFields[f.key]}
                        keyboardType="numeric"
                        onChangeText={(v) =>
                          setEditRateFields((r) => ({ ...r, [f.key]: v }))
                        }
                      />
                    ))}
                    <View
                      style={{ flexDirection: "row", gap: 10, marginTop: 10 }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.button,
                          { flex: 1, backgroundColor: "#007bff" },
                        ]}
                        onPress={handleEditRate}
                      >
                        <Text style={styles.buttonText}>Save</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.button,
                          { flex: 1, backgroundColor: "#ccc" },
                        ]}
                        onPress={() => setEditRateModal(false)}
                      >
                        <Text style={[styles.buttonText, { color: "#333" }]}>
                          Cancel
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              </Modal>
            </View>
          )}
        </>
      )}

      {/* --- WEB SECTIONS AND MODALS --- */}
      {Platform.OS === "web" && (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.heading}>Admin Dashboard</Text>
          </View>
          <View style={styles.webNavBar}>
            <TouchableOpacity
              style={[
                styles.webNavItem,
                activeTab === "qr" && styles.webNavItemActive,
              ]}
              onPress={() => setActiveTab(activeTab === "qr" ? null : "qr")}
            >
              <Ionicons
                name="qr-code-outline"
                size={22}
                style={[
                  styles.webNavIcon,
                  activeTab === "qr" && styles.webNavItemActiveIcon,
                ]}
              />
              <Text
                style={[
                  styles.webNavLabel,
                  activeTab === "qr" && styles.webNavItemActiveLabel,
                ]}
              >
                QR Code
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.webNavItem,
                activeTab === "create" && styles.webNavItemActive,
              ]}
              onPress={() =>
                setActiveTab(activeTab === "create" ? null : "create")
              }
            >
              <Ionicons
                name="person-add-outline"
                size={22}
                style={[
                  styles.webNavIcon,
                  activeTab === "create" && styles.webNavItemActiveIcon,
                ]}
              />
              <Text
                style={[
                  styles.webNavLabel,
                  activeTab === "create" && styles.webNavItemActiveLabel,
                ]}
              >
                Create Account
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.webNavItem,
                activeTab === "manage" && styles.webNavItemActive,
              ]}
              onPress={() =>
                setActiveTab(activeTab === "manage" ? null : "manage")
              }
            >
              <Ionicons
                name="people-outline"
                size={22}
                style={[
                  styles.webNavIcon,
                  activeTab === "manage" && styles.webNavItemActiveIcon,
                ]}
              />
              <Text
                style={[
                  styles.webNavLabel,
                  activeTab === "manage" && styles.webNavItemActiveLabel,
                ]}
              >
                Manage Accounts
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.webNavItem,
                activeTab === "rate" && styles.webNavItemActive,
              ]}
              onPress={() => setActiveTab(activeTab === "rate" ? null : "rate")}
            >
              <Ionicons
                name="calculator-outline"
                size={22}
                style={[
                  styles.webNavIcon,
                  activeTab === "rate" && styles.webNavItemActiveIcon,
                ]}
              />
              <Text
                style={[
                  styles.webNavLabel,
                  activeTab === "rate" && styles.webNavItemActiveLabel,
                ]}
              >
                Utility Rate
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.webNavItem,
                activeTab === "buildings" && styles.webNavItemActive,
              ]}
              onPress={() =>
                setActiveTab(activeTab === "buildings" ? null : "buildings")
              }
            >
              <Ionicons
                name="business-outline"
                size={22}
                style={[
                  styles.webNavIcon,
                  activeTab === "buildings" && styles.webNavItemActiveIcon,
                ]}
              />
              <Text
                style={[
                  styles.webNavLabel,
                  activeTab === "buildings" && styles.webNavItemActiveLabel,
                ]}
              >
                Buildings
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.webNavItem,
                activeTab === "stalls" && styles.webNavItemActive,
              ]}
              onPress={() =>
                setActiveTab(activeTab === "stalls" ? null : "stalls")
              }
            >
              <Ionicons
                name="storefront-outline"
                size={22}
                style={[
                  styles.webNavIcon,
                  activeTab === "stalls" && styles.webNavItemActiveIcon,
                ]}
              />
              <Text
                style={[
                  styles.webNavLabel,
                  activeTab === "stalls" && styles.webNavItemActiveLabel,
                ]}
              >
                Stalls
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.webNavItem,
                activeTab === "tenants" && styles.webNavItemActive,
              ]}
              onPress={() =>
                setActiveTab(activeTab === "tenants" ? null : "tenants")
              }
            >
              <Ionicons
                name="people-circle-outline"
                size={22}
                style={[
                  styles.webNavIcon,
                  activeTab === "tenants" && styles.webNavItemActiveIcon,
                ]}
              />
              <Text
                style={[
                  styles.webNavLabel,
                  activeTab === "tenants" && styles.webNavItemActiveLabel,
                ]}
              >
                Tenants
              </Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* --- BUILDING LIST SECTION --- */}
      {(Platform.OS === "web" ? activeTab : mobileSection) === "buildings" && (
        <View style={styles.dropdownContent}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              Building List
            </Text>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: "#007bff",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
              onPress={openAddBuildingModal}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                Add Building
              </Text>
            </TouchableOpacity>
          </View>
          {buildingsLoadingFull ? (
            <ActivityIndicator
              size="small"
              color="#007bff"
              style={{ margin: 12 }}
            />
          ) : buildingListFull.length === 0 ? (
            <Text style={styles.placeholder}>No buildings found.</Text>
          ) : (
            buildingListFull.map((bldg) => (
              <View key={bldg.building_id} style={styles.userRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold" }}>
                    {bldg.building_id} - {bldg.building_name}
                  </Text>
                  <Text>Rate ID: {bldg.rate_id}</Text>
                  <Text>
                    Last updated: {bldg.last_updated} by {bldg.updated_by}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <TouchableOpacity onPress={() => openEditBuildingModal(bldg)}>
                    <Ionicons name="pencil-outline" size={22} color="#007bff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteBuilding(bldg.building_id)}
                  >
                    <Ionicons name="trash-outline" size={22} color="red" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
          {/* Modal for Add/Edit */}
          <Modal
            visible={showBuildingModal}
            animationType="slide"
            transparent
            onRequestClose={closeBuildingModal}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text
                  style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}
                >
                  {editingBuilding ? "Edit Building" : "Add Building"}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Building Name"
                  value={buildingFields.building_name}
                  onChangeText={(v) =>
                    setBuildingFields((f) => ({ ...f, building_name: v }))
                  }
                />
                {/* Rate ID Picker from your actual rates */}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    marginBottom: 10,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  <Picker
                    selectedValue={buildingFields.rate_id}
                    onValueChange={(v) =>
                      setBuildingFields((f) => ({ ...f, rate_id: v }))
                    }
                    style={{ height: 50, width: "100%" }}
                  >
                    <Picker.Item label="Select Utility Rate..." value="" />
                    {rates.map((r) => (
                      <Picker.Item
                        key={r.rate_id}
                        label={`#${r.rate_id} (E: ${r.erate_perKwH}, W: ${r.wrate_perCbM})`}
                        value={r.rate_id}
                      />
                    ))}
                  </Picker>
                </View>
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#007bff" },
                    ]}
                    onPress={handleSaveBuilding}
                  >
                    <Text style={styles.buttonText}>
                      {editingBuilding ? "Save" : "Add"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#ccc" },
                    ]}
                    onPress={closeBuildingModal}
                  >
                    <Text style={[styles.buttonText, { color: "#333" }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text
              style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}
            >
              Edit User
            </Text>
            <TextInput
              style={styles.input}
              placeholder="Full Name"
              value={editName}
              onChangeText={setEditName}
            />
            {/* Role Picker */}
            <View
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#fff",
                marginBottom: 10,
              }}
            >
              <Picker
                selectedValue={editRole}
                onValueChange={(v) => setEditRole(v)}
                style={{ height: 50, width: "100%" }}
              >
                <Picker.Item label="Employee" value="employee" />
                <Picker.Item label="Admin" value="admin" />
              </Picker>
            </View>
            {/* Building Picker */}
            <View
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#fff",
                marginBottom: 10,
              }}
            >
              <Picker
                selectedValue={editBuilding}
                onValueChange={(v) => setEditBuilding(v)}
                style={{ height: 50, width: "100%" }}
              >
                {buildingList.map((b) => (
                  <Picker.Item
                    key={b.building_id}
                    label={`${b.building_id} - ${b.building_name}`}
                    value={b.building_id}
                  />
                ))}
              </Picker>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Password (leave blank to keep current)"
              value={editPassword}
              onChangeText={setEditPassword}
              secureTextEntry
            />
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
              <TouchableOpacity
                style={[styles.button, { flex: 1, backgroundColor: "#007bff" }]}
                onPress={handleSaveEdit}
              >
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { flex: 1, backgroundColor: "#ccc" }]}
                onPress={closeEditModal}
              >
                <Text style={[styles.buttonText, { color: "#333" }]}>
                  Cancel
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* --- STALL LIST SECTION --- */}
      {(Platform.OS === "web" ? activeTab : mobileSection) === "stalls" && (
        <View style={styles.dropdownContent}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>Stall List</Text>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: "#007bff",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
              onPress={openAddStallModal}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text style={[styles.buttonText, { marginLeft: 8 }]}>
                Add Stall
              </Text>
            </TouchableOpacity>
          </View>
          {stallsLoading ? (
            <ActivityIndicator
              size="small"
              color="#007bff"
              style={{ margin: 12 }}
            />
          ) : stallList.length === 0 ? (
            <Text style={styles.placeholder}>No stalls found.</Text>
          ) : (
            stallList.map((stall) => (
              <View key={stall.stall_id} style={styles.userRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold" }}>
                    {stall.stall_id} - {stall.stall_sn}
                  </Text>
                  <Text>Building: {stall.building_id}</Text>
                  <Text>Status: {stall.stall_status}</Text>
                  <Text>Tenant: {stall.tenant_id || "---"}</Text>
                  <Text style={{ fontSize: 12, color: "#888" }}>
                    Updated {stall.last_updated} by {stall.updated_by}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <TouchableOpacity onPress={() => openEditStallModal(stall)}>
                    <Ionicons name="pencil-outline" size={22} color="#007bff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteStall(stall.stall_id)}
                  >
                    <Ionicons name="trash-outline" size={22} color="red" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          <Modal
            visible={showStallModal}
            animationType="slide"
            transparent
            onRequestClose={closeStallModal}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text
                  style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}
                >
                  {editingStall ? "Edit Stall" : "Add Stall"}
                </Text>

                <TextInput
                  style={styles.input}
                  placeholder="Stall SN"
                  value={stallFields.stall_sn}
                  onChangeText={(v) =>
                    setStallFields((f) => ({ ...f, stall_sn: v }))
                  }
                />

                {/* Building Picker */}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    marginBottom: 10,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  <Picker
                    selectedValue={stallFields.building_id}
                    onValueChange={(v) =>
                      setStallFields((f) => ({ ...f, building_id: v }))
                    }
                    style={{ height: 50, width: "100%" }}
                  >
                    <Picker.Item label="Select Building..." value="" />
                    {buildingList.map((b) => (
                      <Picker.Item
                        key={b.building_id}
                        label={`${b.building_id} - ${b.building_name}`}
                        value={b.building_id}
                      />
                    ))}
                  </Picker>
                </View>

                {/* Tenant Picker */}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    marginBottom: 10,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  <Picker
                    selectedValue={stallFields.tenant_id}
                    onValueChange={(v) =>
                      setStallFields((f) => ({ ...f, tenant_id: v }))
                    }
                    style={{ height: 50, width: "100%" }}
                  >
                    <Picker.Item label="No Tenant" value="" />
                    {availableTenants.map((tenant) => (
                      <Picker.Item
                        key={tenant.tenant_id}
                        label={`${tenant.tenant_id} - ${tenant.tenant_name}`}
                        value={tenant.tenant_id}
                      />
                    ))}
                  </Picker>
                </View>

                {/* Status Picker */}
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    marginBottom: 10,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  <Picker
                    selectedValue={stallFields.stall_status}
                    onValueChange={(v) =>
                      setStallFields((f) => ({ ...f, stall_status: v }))
                    }
                    style={{ height: 50, width: "100%" }}
                  >
                    <Picker.Item label="Available" value="available" />
                    <Picker.Item label="Occupied" value="occupied" />
                    <Picker.Item
                      label="Under Maintenance"
                      value="under maintenance"
                    />
                  </Picker>
                </View>

                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#007bff" },
                    ]}
                    onPress={handleSaveStall}
                  >
                    <Text style={styles.buttonText}>
                      {editingStall ? "Save" : "Add"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#ccc" },
                    ]}
                    onPress={closeStallModal}
                  >
                    <Text style={[styles.buttonText, { color: "#333" }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* --- END MODAL --- */}
        </View>
      )}

      {(Platform.OS === "web" ? activeTab : mobileSection) === "tenants" && (
        <View style={styles.dropdownContent}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              Tenant List
            </Text>
            <TouchableOpacity
              style={[
                styles.button,
                {
                  backgroundColor: "#007bff",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "center",
                },
              ]}
              onPress={openAddTenantModal}
            >
              <Ionicons name="add-circle-outline" size={20} color="#fff" />
              <Text
                style={{
                  color: "#fff",
                  marginLeft: 6,
                  fontWeight: "bold",
                  fontSize: 15,
                }}
              >
                Add Tenant
              </Text>
            </TouchableOpacity>
          </View>
          {tenantsLoading ? (
            <ActivityIndicator
              size="small"
              color="#007bff"
              style={{ margin: 12 }}
            />
          ) : tenantList.length === 0 ? (
            <Text style={styles.placeholder}>No tenants found.</Text>
          ) : (
            tenantList.map((tenant) => (
              <View key={tenant.tenant_id} style={styles.userRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold" }}>
                    {tenant.tenant_id} - {tenant.tenant_sn}
                  </Text>
                  <Text>Name: {tenant.tenant_name}</Text>
                  <Text>Building: {tenant.building_id}</Text>
                  <Text>Start: {tenant.bill_start?.slice(0, 10)}</Text>
                  <Text style={{ fontSize: 12, color: "#888" }}>
                    Updated {tenant.last_updated} by {tenant.updated_by}
                  </Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <TouchableOpacity onPress={() => openEditTenantModal(tenant)}>
                    <Ionicons name="pencil-outline" size={22} color="#007bff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteTenant(tenant.tenant_id)}
                  >
                    <Ionicons name="trash-outline" size={22} color="red" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* Modal for Add/Edit */}
          <Modal
            visible={showTenantModal}
            animationType="slide"
            transparent
            onRequestClose={closeTenantModal}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text
                  style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}
                >
                  {editingTenant ? "Edit Tenant" : "Add Tenant"}
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="Tenant SN"
                  value={tenantFields.tenant_sn}
                  onChangeText={(v) =>
                    setTenantFields((f) => ({ ...f, tenant_sn: v }))
                  }
                />
                <TextInput
                  style={styles.input}
                  placeholder="Tenant Name"
                  value={tenantFields.tenant_name}
                  onChangeText={(v) =>
                    setTenantFields((f) => ({ ...f, tenant_name: v }))
                  }
                />
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: "#ccc",
                    borderRadius: 8,
                    marginBottom: 10,
                    overflow: "hidden",
                    backgroundColor: "#fff",
                  }}
                >
                  <Picker
                    selectedValue={tenantFields.building_id}
                    onValueChange={(v) =>
                      setTenantFields((f) => ({ ...f, building_id: v }))
                    }
                    style={{ height: 50, width: "100%" }}
                  >
                    <Picker.Item label="Select Building..." value="" />
                    {buildingList.map((b) => (
                      <Picker.Item
                        key={b.building_id}
                        label={`${b.building_id} - ${b.building_name}`}
                        value={b.building_id}
                      />
                    ))}
                  </Picker>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Bill Start (YYYY-MM-DD)"
                  value={tenantFields.bill_start}
                  onChangeText={(v) =>
                    setTenantFields((f) => ({ ...f, bill_start: v }))
                  }
                />
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#007bff" },
                    ]}
                    onPress={handleSaveTenant}
                  >
                    <Text style={styles.buttonText}>
                      {editingTenant ? "Save" : "Add"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#ccc" },
                    ]}
                    onPress={closeTenantModal}
                  >
                    <Text style={[styles.buttonText, { color: "#333" }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}

      {Platform.OS === "web" && activeTab === "qr" && (
        <View style={styles.dropdownContent}>
          <TextInput
            style={styles.input}
            placeholder="Text for QR"
            value={text}
            onChangeText={(val) => {
              setText(val);
              setGenerated(val);
            }}
          />
          <View style={styles.qrContainer}>
            {generated ? (
              <>
                <QRCode
                  value={generated}
                  size={200}
                  getRef={(c) => (qrRef.current = c)}
                />
                <TouchableOpacity
                  style={styles.downloadBtn}
                  onPress={handleDownloadQR}
                >
                  <Ionicons name="download-outline" size={20} color="#fff" />
                  <Text style={styles.downloadBtnText}>Download QR</Text>
                </TouchableOpacity>
              </>
            ) : (
              <Text style={styles.placeholder}>QR Preview</Text>
            )}
          </View>
        </View>
      )}

      {Platform.OS === "web" && activeTab === "create" && (
        <View style={styles.dropdownContent}>
          <TextInput
            style={styles.input}
            placeholder="User Full Name"
            value={newUsername}
            onChangeText={setNewUsername}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          {/* Role dropdown */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ marginBottom: 6, fontWeight: "500" }}>Role:</Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              <Picker
                selectedValue={newRole}
                onValueChange={(itemValue) =>
                  setNewRole(itemValue as "admin" | "employee")
                }
                style={{ height: 50, width: "100%" }}
              >
                <Picker.Item label="Employee" value="employee" />
                <Picker.Item label="Admin" value="admin" />
              </Picker>
            </View>
          </View>
          {/* Building dropdown */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ marginBottom: 6, fontWeight: "500" }}>
              Building:
            </Text>
            <View
              style={{
                borderWidth: 1,
                borderColor: "#ccc",
                borderRadius: 8,
                overflow: "hidden",
                backgroundColor: "#fff",
              }}
            >
              {buildingsLoading ? (
                <Text style={{ padding: 12 }}>Loading buildings...</Text>
              ) : (
                <Picker
                  selectedValue={selectedBuildingId}
                  onValueChange={(itemValue) =>
                    setSelectedBuildingId(itemValue)
                  }
                  style={{ height: 50, width: "100%" }}
                >
                  {buildingList.map((b) => (
                    <Picker.Item
                      key={b.building_id}
                      label={`${b.building_id} - ${b.building_name}`}
                      value={b.building_id}
                    />
                  ))}
                </Picker>
              )}
            </View>
          </View>
          <TouchableOpacity style={styles.button} onPress={handleRegister}>
            <Text style={styles.buttonText}>Create Account</Text>
          </TouchableOpacity>
        </View>
      )}

      {Platform.OS === "web" && activeTab === "manage" && (
        <View style={styles.dropdownContent}>
          <TextInput
            style={styles.input}
            placeholder="Search user_id, name, role, building"
            value={filter}
            onChangeText={setFilter}
          />
          {usersLoading ? (
            <ActivityIndicator
              size="small"
              color="#007bff"
              style={{ margin: 12 }}
            />
          ) : filteredUsers.length === 0 ? (
            <Text style={styles.placeholder}>No accounts found.</Text>
          ) : (
            filteredUsers.map((user) => (
              <View key={user.user_id} style={styles.userRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "bold" }}>{user.user_id}</Text>
                  <Text>Name: {user.user_fullname}</Text>
                  <Text>Role: {user.user_level}</Text>
                  <Text>Building: {user.building_id}</Text>
                </View>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  <TouchableOpacity onPress={() => openEditModal(user)}>
                    <Ionicons name="pencil-outline" size={22} color="#007bff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteUser(user.user_id)}
                  >
                    <Ionicons name="trash-outline" size={22} color="red" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* --- UTILITY RATE TAB WEB ONLY --- */}
      {Platform.OS === "web" && activeTab === "rate" && (
        <View style={styles.dropdownContent}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text
              style={{ fontSize: 18, fontWeight: "bold", marginBottom: 10 }}
            >
              Utility Rates
            </Text>
            <TouchableOpacity
              style={{
                backgroundColor: "#007bff",
                borderRadius: 8,
                paddingHorizontal: 16,
                paddingVertical: 8,
                flexDirection: "row",
                alignItems: "center",
              }}
              onPress={() => setShowAddRate(!showAddRate)}
            >
              <Ionicons
                name={showAddRate ? "close" : "add-circle-outline"}
                size={20}
                color="#fff"
              />
              <Text
                style={{
                  color: "#fff",
                  marginLeft: 6,
                  fontWeight: "bold",
                  fontSize: 15,
                }}
              >
                {showAddRate ? "Cancel" : "Add Rate"}
              </Text>
            </TouchableOpacity>
          </View>
          {/* Add Rate Form */}
          {showAddRate && (
            <View style={{ marginBottom: 12 }}>
              {[
                { key: "erate_perKwH", label: "Electric Rate (per kWh)" },
                { key: "e_vat", label: "Electric VAT" },
                { key: "emin_con", label: "Electric Min Consumption" },
                { key: "wmin_con", label: "Water Min Consumption" },
                { key: "wrate_perCbM", label: "Water Rate (per m³)" },
                { key: "wnet_vat", label: "Water Net VAT" },
                { key: "w_vat", label: "Water VAT" },
                { key: "l_rate", label: "LPG Rate" },
              ].map((f) => (
                <TextInput
                  key={f.key}
                  style={styles.input}
                  placeholder={f.label}
                  value={addRateFields[f.key]}
                  keyboardType="numeric"
                  onChangeText={(v) =>
                    setAddRateFields((r) => ({ ...r, [f.key]: v }))
                  }
                />
              ))}
              <TouchableOpacity
                style={[styles.button, { backgroundColor: "#007bff" }]}
                onPress={async () => {
                  for (let k in addRateFields) {
                    if (!addRateFields[k]) {
                      Alert.alert("Required", "All fields are required.");
                      return;
                    }
                  }
                  try {
                    const token = await AsyncStorage.getItem("token");
                    const res = await fetch(API_RATES_URL, {
                      method: "POST",
                      headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                      },
                      body: JSON.stringify({
                        ...addRateFields,
                        erate_perKwH: parseFloat(addRateFields.erate_perKwH),
                        e_vat: parseFloat(addRateFields.e_vat),
                        emin_con: parseFloat(addRateFields.emin_con),
                        wmin_con: parseFloat(addRateFields.wmin_con),
                        wrate_perCbM: parseFloat(addRateFields.wrate_perCbM),
                        wnet_vat: parseFloat(addRateFields.wnet_vat),
                        w_vat: parseFloat(addRateFields.w_vat),
                        l_rate: parseFloat(addRateFields.l_rate),
                      }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      Alert.alert("Success", "Rate added.");
                      setAddRateFields({
                        erate_perKwH: "",
                        e_vat: "",
                        emin_con: "",
                        wmin_con: "",
                        wrate_perCbM: "",
                        wnet_vat: "",
                        w_vat: "",
                        l_rate: "",
                      });
                      setShowAddRate(false);
                      fetchRates();
                    } else {
                      Alert.alert("Error", data?.error || "Server error");
                    }
                  } catch {
                    Alert.alert("Error", "Network or server error");
                  }
                }}
              >
                <Text style={styles.buttonText}>Add Rate</Text>
              </TouchableOpacity>
            </View>
          )}
          {/* Rate List with Edit/Delete */}
          {rateLoading ? (
            <ActivityIndicator
              size="small"
              color="#007bff"
              style={{ margin: 12 }}
            />
          ) : rates.length === 0 ? (
            <Text style={styles.placeholder}>No utility rates found.</Text>
          ) : (
            <View>
              {rates.map((rate) => (
                <View
                  key={rate.rate_id}
                  style={{
                    padding: 10,
                    borderBottomColor: "#ccc",
                    borderBottomWidth: 1,
                    flexDirection: "row",
                    alignItems: "center", // keeps text and icons aligned
                  }}
                >
                  {/* Left: rate info */}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: "bold" }}>
                      <Text>ID: {rate.rate_id}</Text>
                    </Text>
                    <Text>
                      Electric: {rate.erate_perKwH} / VAT: {rate.e_vat}
                    </Text>
                    <Text>
                      Min: {rate.emin_con} / Water: {rate.wrate_perCbM}
                    </Text>
                    <Text>
                      VAT: {rate.w_vat} / Net VAT: {rate.wnet_vat}
                    </Text>
                    <Text>
                      {" "}
                      Min: {rate.wmin_con} / LPG: {rate.l_rate}
                    </Text>
                  </View>
                  {/* Right: Edit/Delete icons */}
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <TouchableOpacity
                      onPress={() => openEditRateModal(rate)}
                      style={{ padding: 10 }}
                    >
                      <Ionicons
                        name="pencil-outline"
                        size={22}
                        color="#007bff"
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteRate(rate.rate_id)}
                      style={{ padding: 10 }}
                    >
                      <Ionicons name="trash-outline" size={22} color="red" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* --- Edit Rate Modal --- */}
          <Modal
            visible={editRateModal}
            animationType="slide"
            transparent
            onRequestClose={() => setEditRateModal(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalContainer}>
                <Text
                  style={{ fontWeight: "bold", fontSize: 18, marginBottom: 10 }}
                >
                  Edit Utility Rate
                </Text>
                {[
                  { key: "erate_perKwH", label: "Electric Rate (per kWh)" },
                  { key: "e_vat", label: "Electric VAT" },
                  { key: "emin_con", label: "Electric Min Consumption" },
                  { key: "wmin_con", label: "Water Min Consumption" },
                  { key: "wrate_perCbM", label: "Water Rate (per m³)" },
                  { key: "wnet_vat", label: "Water Net VAT" },
                  { key: "w_vat", label: "Water VAT" },
                  { key: "l_rate", label: "LPG Rate" },
                ].map((f) => (
                  <TextInput
                    key={f.key}
                    style={styles.input}
                    placeholder={f.label}
                    value={editRateFields[f.key]}
                    keyboardType="numeric"
                    onChangeText={(v) =>
                      setEditRateFields((r) => ({ ...r, [f.key]: v }))
                    }
                  />
                ))}
                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#007bff" },
                    ]}
                    onPress={handleEditRate}
                  >
                    <Text style={styles.buttonText}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { flex: 1, backgroundColor: "#ccc" },
                    ]}
                    onPress={() => setEditRateModal(false)}
                  >
                    <Text style={[styles.buttonText, { color: "#333" }]}>
                      Cancel
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  headerMobile: {
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  hamburgerBtn: {
    position: "absolute",
    left: 0,
    top: 10,
    padding: 12,
    zIndex: 2,
  },
  logoCenterContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    height: 70,
  },
  logoutIconBtn: {
    position: "absolute",
    right: 0,
    top: 10,
    padding: 12,
    zIndex: 2,
  },
  logo: {
    width: 80,
    height: 80,
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "flex-start",
    alignItems: "flex-start",
  },
  menuDrawer: {
    backgroundColor: "#fff",
    borderTopRightRadius: 18,
    borderBottomRightRadius: 18,
    padding: 22,
    width: 230,
    elevation: 12,
    marginTop: 48,
  },
  webNavBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-start",
    marginBottom: 6,
    gap: 8,
  },
  webNavItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: "#f5f5f5",
    marginRight: 8,
  },
  webNavItemActive: {
    backgroundColor: "#007bff",
  },
  webNavLabel: {
    fontSize: 16,
    fontWeight: "bold",
    marginLeft: 7,
    color: "#333",
  },
  webNavIcon: {
    color: "#333",
  },
  webNavItemActiveLabel: {
    color: "#fff",
  },
  webNavItemActiveIcon: {
    color: "#fff",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#333",
    alignSelf: "flex-start",
    marginBottom: 12,
    marginLeft: 6,
  },
  dropdownContent: {
    backgroundColor: "#f9f9f9",
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  qrContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 10,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 10,
    minHeight: 200,
  },
  placeholder: {
    color: "#999",
    fontSize: 16,
  },
  button: {
    backgroundColor: "#28a745",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },
  downloadBtn: {
    marginTop: 12,
    backgroundColor: "#007bff",
    padding: 10,
    borderRadius: 8,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  downloadBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },
  userRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomColor: "#ccc",
    borderBottomWidth: 1,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.3)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    width: "90%",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  drawerOverlay: {
    flex: 1,
    flexDirection: "row",
    zIndex: 99,
  },
  drawerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  drawerMenu: {
    width: "75%",
    maxWidth: 340,
    height: "100%",
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingTop: 24,
    justifyContent: "flex-start",
  },
  drawerMenuTitle: {
    fontWeight: "bold",
    fontSize: 22,
    marginBottom: 26,
    marginLeft: 4,
    marginTop: 12,
    color: "#222",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 2,
    borderRadius: 0,
    marginBottom: 8,
  },
  menuIcon: {
    marginRight: 12,
    color: "#007bff",
  },
  menuText: {
    fontSize: 17,
    color: "#222",
    fontWeight: "600",
  },
});