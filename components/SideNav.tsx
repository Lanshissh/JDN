import React from 'react';
import { View, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type TabKey = 'admin' | 'scanner' | 'history' | 'logout';

type Props = {
  active: TabKey;
  onSelect: (tab: TabKey) => void;
};

export default function SideNav({ active, onSelect }: Props) {
  return (
    <View style={styles.sideNav}>
      <TouchableOpacity style={styles.iconBtn} onPress={() => onSelect('admin')}>
        <Image source={require('../assets/images/jdn.jpg')} style={styles.logo} />
      </TouchableOpacity>
      <View style={styles.navSection}>
        <TouchableOpacity
          style={[styles.iconBtn, active === 'admin' && styles.active]}
          onPress={() => onSelect('admin')}
        >
          <Ionicons name="person-circle-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, active === 'scanner' && styles.active]}
          onPress={() => onSelect('scanner')}
        >
          <Ionicons name="scan-outline" size={28} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.iconBtn, active === 'history' && styles.active]}
          onPress={() => onSelect('history')}
        >
          <Ionicons name="time-outline" size={28} color="#fff" />
        </TouchableOpacity>
      </View>
      <View style={{ flex: 1 }} />
      <TouchableOpacity style={styles.iconBtn} onPress={() => onSelect('logout')}>
        <Ionicons name="log-out-outline" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sideNav: {
    width: 68,
    backgroundColor: '#082cac',
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 20,
    borderRightWidth: 1,
    borderRightColor: '#eee',
    flexDirection: 'column',
    height: '100%',
  },
  navSection: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
  },
  iconBtn: {
    marginVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    width: 48,
    height: 48,
    borderRadius: 16,
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  active: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
});