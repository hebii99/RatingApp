import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text, TextInput,
  TouchableOpacity,
  View
} from 'react-native';

export default function Index() {
  const { signOut } = useAuth();
  const [direccion, setDireccion] = useState('');
  const [acceso, setAcceso] = useState('');
  const [trato, setTrato] = useState('');
  const [propina, setPropina] = useState('');
  const [seguridad, setSeguridad] = useState(0);
  const [peso, setPeso] = useState('');
  const [repetir, setRepetir] = useState('');
  const [comentario, setComentario] = useState('');
  const [calificacion, setCalificacion] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const opcionesAcceso = ['Fácil', 'Difícil', 'Sin ascensor', 'Portero'];
  const opcionesTrato = ['Muy bueno', 'Bueno', 'Normal', 'Malo', 'Muy malo'];
  const opcionesPropina = ['Sí', 'No', 'A veces'];
  const opcionesPeso = ['Liviano', 'Medio', 'Pesado'];
  const opcionesRepetir = ['Sí', 'No', 'Me da igual'];

  const Selector = ({ opciones, valor, onChange }: any) => (
    <View style={styles.selectorRow}>
      {opciones.map((op: string) => (
        <TouchableOpacity
          key={op}
          style={[styles.chip, valor === op && styles.chipActivo]}
          onPress={() => onChange(op)}
        >
          <Text style={[styles.chipText, valor === op && styles.chipTextActivo]}>
            {op}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const Estrellas = ({ valor, onChange }: any) => (
    <View style={styles.selectorRow}>
      {[1, 2, 3, 4, 5].map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n)}>
          <Text style={[styles.estrella, n <= valor && styles.estrellaActiva]}>
            ★
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  const limpiarFormulario = () => {
    setDireccion('');
    setAcceso('');
    setTrato('');
    setPropina('');
    setSeguridad(0);
    setPeso('');
    setRepetir('');
    setComentario('');
    setCalificacion(0);
  };

  const obtenerSemana = () => {
  const ahora = new Date();
  const mes = ahora.toLocaleString('es-AR', { month: 'short' });
  const semanaDelMes = Math.ceil(ahora.getDate() / 7);
  return `${mes} w${semanaDelMes}`;
};

  const guardar = async () => {
    if (!direccion.trim()) {
      Alert.alert('Error', 'La dirección es obligatoria');
      return;
    }

    setGuardando(true);

    const { error } = await supabase.from('calificaciones').insert({
    direccion,
    acceso,
    trato,
    propina,
    seguridad,
    peso,
    repetir,
    comentario,
    calificacion,
    fecha: new Date().toLocaleDateString('es-AR'),
    semana: obtenerSemana(),
    });

    setGuardando(false);

    if (error) {
      Alert.alert('Error', 'No se pudo guardar: ' + error.message);
      return;
    }

    Alert.alert('✓ Guardado', `Calificación para ${direccion} guardada correctamente`, [
      { text: 'OK', onPress: limpiarFormulario }
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.headerRow}>
  <Text style={styles.titulo}>Califica la entrega</Text>
  <TouchableOpacity onPress={signOut} style={styles.logoutButton}>
    <Text style={styles.logoutText}>Salir</Text>
  </TouchableOpacity>
</View>

      <Text style={styles.label}>Dirección *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Av. Siempre Viva 123"
        placeholderTextColor="#666"
        value={direccion}
        onChangeText={setDireccion}
      />

      <Text style={styles.label}>Acceso</Text>
      <Selector opciones={opcionesAcceso} valor={acceso} onChange={setAcceso} />

      <Text style={styles.label}>Trato del cliente</Text>
      <Selector opciones={opcionesTrato} valor={trato} onChange={setTrato} />

      <Text style={styles.label}>Propina</Text>
      <Selector opciones={opcionesPropina} valor={propina} onChange={setPropina} />

      <Text style={styles.label}>Seguridad de la zona</Text>
      <Estrellas valor={seguridad} onChange={setSeguridad} />

      <Text style={styles.label}>Peso del pedido</Text>
      <Selector opciones={opcionesPeso} valor={peso} onChange={setPeso} />

      <Text style={styles.label}>¿Repetirías?</Text>
      <Selector opciones={opcionesRepetir} valor={repetir} onChange={setRepetir} />

      <Text style={styles.label}>Comentario</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Detalles adicionales..."
        placeholderTextColor="#666"
        value={comentario}
        onChangeText={setComentario}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Calificación general</Text>
      <Estrellas valor={calificacion} onChange={setCalificacion} />

      <Text style={styles.label}>Semana</Text>

      <TouchableOpacity
        style={[styles.boton, guardando && styles.botonDesactivado]}
        onPress={guardar}
        disabled={guardando}
      >
        <Text style={styles.botonTexto}>
          {guardando ? 'Guardando...' : 'Guardar'}
        </Text>
      </TouchableOpacity>

      <View style={{ height: 70 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 20, paddingTop: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  headerRow: {
  flexDirection: 'row',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 24,
},
logoutButton: {
  paddingHorizontal: 12,
  paddingVertical: 6,
  borderRadius: 8,
  borderWidth: 1,
  borderColor: '#444',
},
logoutText: {
  color: '#aaa',
  fontSize: 13,
},
  label: { color: '#aaa', fontSize: 13, marginBottom: 8, marginTop: 16 },
  input: {
    backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8,
    padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#333'
  },
  inputMultiline: { height: 80, textAlignVertical: 'top' },
  selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 20, borderWidth: 1, borderColor: '#444', backgroundColor: '#1e1e1e'
  },
  chipActivo: { backgroundColor: '#e53e3e', borderColor: '#e53e3e' },
  chipText: { color: '#aaa', fontSize: 13 },
  chipTextActivo: { color: '#fff', fontWeight: 'bold' },
  estrella: { fontSize: 36, color: '#444', marginRight: 4 },
  estrellaActiva: { color: '#e53e3e' },
  boton: {
    backgroundColor: '#e53e3e', padding: 16, borderRadius: 10,
    alignItems: 'center', marginTop: 32
  },
  botonDesactivado: { backgroundColor: '#666' },
  botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});