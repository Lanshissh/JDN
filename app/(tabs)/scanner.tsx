import {
  OnSuccessfulScanProps,
  QRCodeScanner,
} from "@masumdev/rn-qrcode-scanner";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useState } from "react";
import { Alert, Image, StyleSheet, Text, View } from "react-native";
import { useScanHistory } from "../../contexts/ScanHistoryContext";

export default function ScannerScreen() {
  const router = useRouter();
  const { addScan } = useScanHistory();
  const [scanned, setScanned] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  const handleScan = (data: OnSuccessfulScanProps) => {
    if (scanned) return;
    setScanned(true);

    const scanText =
      (data as any)?.rawData || (data as any)?.data || JSON.stringify(data);

    addScan({ data: String(scanText), timestamp: new Date().toISOString() });

    // Jump to History so the dashboard fetches immediately
    router.replace("/(tabs)/history");

    Alert.alert("Scanned!", String(scanText));
    setTimeout(() => setScanned(false), 3000);
  };

  useFocusEffect(
    React.useCallback(() => {
      setScannerKey((prev) => prev + 1); // re-create scanner on focus
    }, [])
  );

  return (
    <View style={styles.container}>
      <QRCodeScanner
        key={scannerKey}
        core={{ onSuccessfulScan: handleScan }}
        permissionScreen={{}}
      />
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>
      <View style={styles.overlay}>
        <Text style={styles.overlayText}>Point your camera at a QR Code</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  logoContainer: {
    position: "absolute",
    top: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 10,
  },
  logo: { width: 100, height: 100, opacity: 0.9 },
  overlay: {
    position: "absolute",
    bottom: 60,
    width: "100%",
    alignItems: "center",
  },
  overlayText: {
    color: "#fff",
    fontSize: 16,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 8,
    borderRadius: 10,
  },
});