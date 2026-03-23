import { StyleSheet, Text, View } from 'react-native';

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Neuro-Endo Checker</Text>
      <Text style={styles.subtitle}>脳血管内治療デバイス互換性確認ツール</Text>
      <Text style={styles.placeholder}>（Phase 3 で実装予定）</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  placeholder: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 16,
  },
});
