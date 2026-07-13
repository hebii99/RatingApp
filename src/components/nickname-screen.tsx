import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

export default function NicknameScreen() {
  const { saveNickname, skipNickname } = useAuth();
  const [nickname, setNickname] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    if (!nickname.trim()) {
      Alert.alert('Ojo', 'Escribí un nickname o tocá "Ahora no"');
      return;
    }

    try {
      setLoading(true);
      await saveNickname(nickname.trim());
    } catch (error: any) {
      if (error.message?.includes('duplicate')) {
        Alert.alert('Error', 'Ese nickname ya está en uso, probá con otro');
      } else {
        Alert.alert('Error', 'No se pudo guardar: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSkip() {
    try {
      setLoading(true);
      await skipNickname();
    } catch (error: any) {
      Alert.alert('Error', 'No se pudo continuar: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Elegí un nickname</Text>
      <Text style={styles.subtitle}>
        Así identificamos tus calificaciones sin usar tu nombre real
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Ej: repartidor_pro"
        placeholderTextColor="#666"
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="none"
        editable={!loading}
      />

      <Pressable style={styles.button} onPress={handleSave} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Guardar</Text>}
      </Pressable>

      <Pressable onPress={handleSkip} disabled={loading}>
        <Text style={styles.skipText}>Ahora no</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: 'bold' },
  subtitle: { fontSize: 14, color: '#666', textAlign: 'center', marginBottom: 20 },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#e53e3e',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 8,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  skipText: { color: '#999', fontSize: 14, marginTop: 12 },
});