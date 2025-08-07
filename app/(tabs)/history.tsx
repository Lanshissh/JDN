import React from "react";
import { FlatList, Image, StyleSheet, Text, View } from "react-native";
import { useScanHistory } from "../../contexts/ScanHistoryContext";

export default function HistoryScreen() {
  const { scans } = useScanHistory();

  return (
    <View style={styles.container}>
      {}
      <View style={styles.header}>
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>Scan History</Text>
      </View>

      {scans.length === 0 ? (
        <Text style={styles.noHistory}>No scans yet.</Text>
      ) : (
        <FlatList
          data={scans}
          keyExtractor={(_, index) => index.toString()}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.data}>{item.data}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.timestamp).toLocaleString()}
              </Text>
            </View>
          )}
          contentContainerStyle={{ paddingBottom: 20 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: "#f9f9f9",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  logo: {
    width: 80,
    height: 80,
    marginRight: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#333",
  },
  noHistory: {
    fontSize: 16,
    color: "#888",
    textAlign: "center",
    marginTop: 32,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 14,
    marginBottom: 12,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  data: {
    fontSize: 16,
    fontWeight: "500",
    color: "#222",
  },
  timestamp: {
    fontSize: 12,
    color: "#666",
    marginTop: 4,
  },
});