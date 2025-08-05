import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput,
  TouchableOpacity, View, ActivityIndicator, Modal, Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Picker } from '@react-native-picker/picker';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_USERS_URL = 'http://192.168.200.111:3000/users';
const API_BUILDINGS_URL = 'http://192.168.200.111:3000/buildings';

export default function AdminScreen() {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'employee'>('employee');
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('');
  const [showQR, setShowQR] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showManageAccounts, setShowManageAccounts] = useState(false);
  const [buildingList, setBuildingList] = useState<{ building_id: string; building_name: string }[]>([]);
  const [buildingsLoading, setBuildingsLoading] = useState(true);
  const [usersLoading, setUsersLoading] = useState(false);
  const [users, setUsers] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const [text, setText] = useState('');
  const [generated, setGenerated] = useState('');
  const qrRef = useRef<any>(null);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'employee'>('employee');
  const [editBuilding, setEditBuilding] = useState('');
  const [editPassword, setEditPassword] = useState('');

  const router = useRouter();

  // Fetch buildings on mount
  useEffect(() => {
    const fetchBuildings = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        const res = await fetch(API_BUILDINGS_URL, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        if (res.ok) {
          setBuildingList(data);
          if (data.length > 0) setSelectedBuildingId(data[0].building_id);
        } else {
          setBuildingList([]);
          setSelectedBuildingId('');
        }
      } catch (err) {
        setBuildingList([]);
        setSelectedBuildingId('');
      }
      setBuildingsLoading(false);
    };
    fetchBuildings();
  }, []);

  // Fetch users whenever manage accounts section is opened
  const fetchUsers = async () => {
    setUsersLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(API_USERS_URL, {
        headers: { Authorization: `Bearer ${token}` }
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
    if (showManageAccounts) fetchUsers();
  }, [showManageAccounts]);

  // Filter logic
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

  // Create account
  const handleRegister = async () => {
    if (!newUsername || !newPassword || !selectedBuildingId) {
      return Alert.alert('Missing Fields', 'Please enter username, password, and select a building.');
    }
    const validBuilding = buildingList.some(b => b.building_id === selectedBuildingId);
    if (!validBuilding) {
      return Alert.alert('Invalid Building', `Building ID "${selectedBuildingId}" does not exist.`);
    }
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(API_USERS_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
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
        throw new Error(data.error || 'Unknown server error');
      }
      Alert.alert('Success', `Account created. User ID: ${data.userId}`);
      setNewUsername('');
      setNewPassword('');
      setSelectedBuildingId(buildingList[0]?.building_id || '');
      if (showManageAccounts) fetchUsers();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not create user');
    }
  };

  // Delete user from API and refresh list
  const handleDeleteUser = (user_id: string) => {
    Alert.alert('Delete Account', `Remove user "${user_id}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('token');
            const res = await fetch(`${API_USERS_URL}/${user_id}`, {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Could not delete user');
            Alert.alert('Deleted', `User ${user_id} deleted successfully.`);
            fetchUsers();
          } catch (err: any) {
            Alert.alert('Error', err?.message || 'Could not delete user');
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
    setEditPassword('');
    setEditModalVisible(true);
  };
  const closeEditModal = () => {
    setEditModalVisible(false);
    setEditUser(null);
  };
  const handleSaveEdit = async () => {
    if (!editUser) return;
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`${API_USERS_URL}/${editUser.user_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_password: editPassword ? editPassword : undefined,
          user_fullname: editName,
          user_level: editRole,
          building_id: editBuilding,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update user');
      Alert.alert('Updated', `User ${editUser.user_id} updated successfully.`);
      closeEditModal();
      fetchUsers();
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Could not update user');
    }
  };

  const handleDownloadQR = async () => {
    if (!qrRef.current) return;
    qrRef.current.toDataURL?.(async (dataURL: string) => {
      const uri = FileSystem.cacheDirectory + 'qr-code.png';
      await FileSystem.writeAsStringAsync(uri, dataURL, { encoding: FileSystem.EncodingType.Base64 });
      await Sharing.shareAsync(uri);
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
    {/* Mobile: logo centered, heading left-aligned */}
    {Platform.OS !== 'web' && (
      <>
        <View style={styles.logoContainer}>
          <Image
            source={require('../../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>
        <Text style={styles.heading}>Admin Dashboard</Text>
      </>
    )}
    {/* Web: heading only, left-aligned */}
    {Platform.OS === 'web' && (
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Admin Dashboard</Text>
      </View>
    )}
      {/* QR Generator */}
      <Pressable style={styles.dropdownHeader} onPress={() => setShowQR(!showQR)}>
        <Text style={styles.dropdownTitle}>QR Code Generator</Text>
        <Ionicons name={showQR ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {showQR && (
        <View style={styles.dropdownContent}>
          <TextInput
            style={styles.input}
            placeholder="Text for QR"
            value={text}
            onChangeText={val => {
              setText(val);
              setGenerated(val);
            }}
          />
          <View style={styles.qrContainer}>
            {generated ? (
              <>
                <QRCode value={generated} size={200} getRef={c => (qrRef.current = c)} />
                <TouchableOpacity style={styles.downloadBtn} onPress={handleDownloadQR}>
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

      {/* Create Account */}
      <Pressable style={styles.dropdownHeader} onPress={() => setShowAccount(!showAccount)}>
        <Text style={styles.dropdownTitle}>Create New Account</Text>
        <Ionicons name={showAccount ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {showAccount && (
        <View style={styles.dropdownContent}>
          <TextInput
            style={styles.input}
            placeholder="Username"
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
            <Text style={{ marginBottom: 6, fontWeight: '500' }}>Role:</Text>
            <View style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#fff'
            }}>
              <Picker
                selectedValue={newRole}
                onValueChange={(itemValue) => setNewRole(itemValue as 'admin' | 'employee')}
                style={{ height: 50, width: '100%' }}
              >
                <Picker.Item label="Employee" value="employee" />
                <Picker.Item label="Admin" value="admin" />
              </Picker>
            </View>
          </View>
          {/* Building dropdown */}
          <View style={{ marginBottom: 10 }}>
            <Text style={{ marginBottom: 6, fontWeight: '500' }}>Building:</Text>
            <View style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              overflow: 'hidden',
              backgroundColor: '#fff'
            }}>
              {buildingsLoading ? (
                <Text style={{ padding: 12 }}>Loading buildings...</Text>
              ) : (
                <Picker
                  selectedValue={selectedBuildingId}
                  onValueChange={itemValue => setSelectedBuildingId(itemValue)}
                  style={{ height: 50, width: '100%' }}
                >
                  {buildingList.map(b => (
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

      {/* Manage Accounts */}
      <Pressable style={styles.dropdownHeader} onPress={() => setShowManageAccounts(!showManageAccounts)}>
        <Text style={styles.dropdownTitle}>Manage Accounts</Text>
        <Ionicons name={showManageAccounts ? 'chevron-up' : 'chevron-down'} size={20} />
      </Pressable>
      {showManageAccounts && (
        <View style={styles.dropdownContent}>
          {/* Filter/search bar */}
          <TextInput
            style={styles.input}
            placeholder="Search user_id, name, role, building"
            value={filter}
            onChangeText={setFilter}
          />
          {usersLoading ? (
            <ActivityIndicator size="small" color="#007bff" style={{ margin: 12 }} />
          ) : filteredUsers.length === 0 ? (
            <Text style={styles.placeholder}>No accounts found.</Text>
          ) : (
            filteredUsers.map(user => (
              <View key={user.user_id} style={styles.userRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: 'bold' }}>{user.user_id}</Text>
                  <Text>Name: {user.user_fullname}</Text>
                  <Text>Role: {user.user_level}</Text>
                  <Text>Building: {user.building_id}</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <TouchableOpacity onPress={() => openEditModal(user)}>
                    <Ionicons name="pencil-outline" size={22} color="#007bff" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDeleteUser(user.user_id)}>
                    <Ionicons name="trash-outline" size={22} color="red" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      {/* Edit User Modal */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeEditModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 10 }}>Edit User</Text>
            <Text>User ID: {editUser?.user_id}</Text>
            <TextInput
              style={styles.input}
              placeholder="Name"
              value={editName}
              onChangeText={setEditName}
            />
            {/* Role picker */}
            <View style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              marginBottom: 10,
              overflow: 'hidden',
              backgroundColor: '#fff'
            }}>
              <Picker
                selectedValue={editRole}
                onValueChange={(val) => setEditRole(val as 'admin' | 'employee')}
                style={{ height: 50, width: '100%' }}
              >
                <Picker.Item label="Employee" value="employee" />
                <Picker.Item label="Admin" value="admin" />
              </Picker>
            </View>
            {/* Building picker */}
            <View style={{
              borderWidth: 1,
              borderColor: '#ccc',
              borderRadius: 8,
              marginBottom: 10,
              overflow: 'hidden',
              backgroundColor: '#fff'
            }}>
              <Picker
                selectedValue={editBuilding}
                onValueChange={setEditBuilding}
                style={{ height: 50, width: '100%' }}
              >
                {buildingList.map(b => (
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
              placeholder="New Password (leave blank to keep unchanged)"
              value={editPassword}
              onChangeText={setEditPassword}
              secureTextEntry
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#007bff' }]} onPress={handleSaveEdit}>
                <Text style={styles.buttonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: '#ccc' }]} onPress={closeEditModal}>
                <Text style={[styles.buttonText, { color: '#333' }]}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    marginTop: 6,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  heading: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    alignSelf: 'flex-start',
    marginBottom: 12,
    marginLeft: 6,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e6e6e6ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 10,
  },
  dropdownTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  dropdownContent: {
    backgroundColor: '#f9f9f9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
  },
  qrContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 10,
    minHeight: 200,
  },
  placeholder: {
    color: '#999',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#28a745',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  downloadBtn: {
    marginTop: 12,
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 8,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
  },
  downloadBtnText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  userRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderBottomColor: '#ccc',
    borderBottomWidth: 1,
    paddingVertical: 10,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    minWidth: 280,
    width: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
});