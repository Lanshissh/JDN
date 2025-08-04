import { Ionicons } from '@expo/vector-icons';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import React, { useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useRouter } from 'expo-router';

export default function AdminScreen() {
  const [text, setText] = useState('');
  const [generated, setGenerated] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'admin1' | 'admin2'>('admin2');
  const [showQR, setShowQR] = useState(false);
  const [showAccount, setShowAccount] = useState(false);
  const [showManageAccounts, setShowManageAccounts] = useState(false);
  const [users, setUsers] = useState<{ username: string; role: string }[]>([]);

  const qrRef = useRef<any>(null);
  const router = useRouter();

  const handleLogout = () => {
    router.replace('/(auth)/login');
  };

  const handleRegister = () => {
    if (!newUsername || !newPassword) {
      return Alert.alert('Missing Fields', 'Please enter username and password.');
    }

    const exists = users.some(u => u.username === newUsername);
    if (exists) {
      return Alert.alert('Error', 'Username already exists.');
    }

    const newUser = { username: newUsername, role: newRole };
    setUsers(prev => [...prev, newUser]);
    Alert.alert('Success', 'Account created.');

    setNewUsername('');
    setNewPassword('');
  };

  const handleDeleteUser = (username: string) => {
    Alert.alert('Delete Account', `Remove "${username}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setUsers(prev => prev.filter(u => u.username !== username));
        },
      },
    ]);
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
      <View style={styles.headerRow}>
        <Image source={require('../../assets/images/logo.png')} style={styles.headerLogo} resizeMode="contain" />
        <Text style={styles.heading}>Admin Dashboard</Text>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={24} color="#dc3545" />
        </TouchableOpacity>
      </View>
        
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
          <TextInput style={styles.input} placeholder="Username" value={newUsername} onChangeText={setNewUsername} />
          <TextInput style={styles.input} placeholder="Password" value={newPassword} onChangeText={setNewPassword} secureTextEntry />
          <Pressable style={styles.input} onPress={() => setNewRole(prev => (prev === 'admin1' ? 'admin2' : 'admin1'))}>
            <Text>Select role: {newRole}</Text>
          </Pressable>
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
          {users.length === 0 ? (
            <Text style={styles.placeholder}>No accounts yet.</Text>
          ) : (
            users.map(user => (
              <View key={user.username} style={styles.userRow}>
                <View>
                  <Text>{user.username}</Text>
                  <Text style={{ color: '#777' }}>{user.role}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDeleteUser(user.username)}>
                  <Ionicons name="trash-outline" size={20} color="red" />
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#fff',
    flexGrow: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  headerLogo: {
    width: 80,
    height: 80,
    marginRight: 10,
  },
  heading: {
    fontSize: 22,
    fontWeight: 'bold',
  },
  logoutBtn: {
    marginLeft: 'auto',
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoutText: {
    color: '#dc3545',
    fontWeight: 'bold',
    marginLeft: 4,
    fontSize: 16,
  },
  dropdownHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#e6e6e6',
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
  },
});