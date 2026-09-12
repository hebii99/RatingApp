import { AjustesModal } from '@/components/ajustes-modal';
import { Colores, useTema } from '@/contexts/TemaContext';
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
  const { colores } = useTema();
  const styles = crearEstilos(colores);
  const [ajustesVisible, setAjustesVisible] = useState(false);
  const [direccion, setDireccion] = useState('');
  const [trato, setTrato] = useState('');
  // Reemplaza al viejo selector Sí/No/A veces: si queda vacío, no hubo propina.
  const [montoPropina, setMontoPropina] = useState('');
  const [seguridad, setSeguridad] = useState(0);
  const [repetir, setRepetir] = useState('');
  const [comentario, setComentario] = useState('');
  const [calificacion, setCalificacion] = useState(0);
  const [guardando, setGuardando] = useState(false);

  const opcionesTrato = ['Bueno', 'Normal', 'Malo'];
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
    setTrato('');
    setMontoPropina('');
    setSeguridad(0);
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

    // La propina es opcional: si escribió algo, tiene que ser un entero > 0.
    let montoPropinaNumero: number | null = null;
    if (montoPropina.trim()) {
      const parseado = parseInt(montoPropina, 10);
      if (isNaN(parseado) || parseado <= 0) {
        Alert.alert('Propina inválida', 'Ingresá un número entero mayor a 0, o dejalo vacío si no hubo propina');
        return;
      }
      montoPropinaNumero = parseado;
    }

    setGuardando(true);

    const { error } = await supabase.from('calificaciones').insert({
    direccion,
    trato,
    monto_propina: montoPropinaNumero,
    seguridad,
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
        <TouchableOpacity onPress={() => setAjustesVisible(true)} style={styles.engranajeBoton}>
          <Text style={styles.engranajeTexto}>⚙️</Text>
        </TouchableOpacity>
      </View>

      <AjustesModal visible={ajustesVisible} onClose={() => setAjustesVisible(false)} />

      <Text style={styles.label}>Dirección *</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: Av. Siempre Viva 123"
        placeholderTextColor={colores.textoSecundario}
        value={direccion}
        onChangeText={setDireccion}
      />

      <Text style={styles.label}>Trato del cliente</Text>
      <Selector opciones={opcionesTrato} valor={trato} onChange={setTrato} />

      <Text style={styles.label}>Propina (opcional)</Text>
      <TextInput
        style={styles.input}
        placeholder="Ej: 300 — dejalo vacío si no hubo propina"
        placeholderTextColor={colores.textoSecundario}
        value={montoPropina}
        onChangeText={setMontoPropina}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Seguridad de la zona</Text>
      <Estrellas valor={seguridad} onChange={setSeguridad} />

      <Text style={styles.label}>¿Repetirías?</Text>
      <Selector opciones={opcionesRepetir} valor={repetir} onChange={setRepetir} />

      <Text style={styles.label}>Comentario</Text>
      <TextInput
        style={[styles.input, styles.inputMultiline]}
        placeholder="Detalles adicionales..."
        placeholderTextColor={colores.textoSecundario}
        value={comentario}
        onChangeText={setComentario}
        multiline
        numberOfLines={3}
      />

      <Text style={styles.label}>Calificación general</Text>
      <Estrellas valor={calificacion} onChange={setCalificacion} />

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

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colores.fondo, padding: 20, paddingTop: 60 },
    titulo: { fontSize: 24, fontWeight: 'bold', color: colores.texto },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 0,
    },
    engranajeBoton: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colores.borde,
    },
    engranajeTexto: {
      fontSize: 18,
    },
    label: { color: colores.textoSecundario, fontSize: 13, marginBottom: 8, marginTop: 16 },
    input: {
      backgroundColor: colores.tarjeta, color: colores.texto, borderRadius: 8,
      padding: 12, fontSize: 15, borderWidth: 1, borderColor: colores.borde
    },
    inputMultiline: { height: 70, textAlignVertical: 'top' },
    selectorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      paddingHorizontal: 12, paddingVertical: 6,
      borderRadius: 20, borderWidth: 1, borderColor: colores.borde, backgroundColor: colores.tarjeta
    },
    chipActivo: { backgroundColor: colores.acento, borderColor: colores.acento },
    chipText: { color: colores.textoSecundario, fontSize: 13 },
    chipTextActivo: { color: '#fff', fontWeight: 'bold' },
    estrella: { fontSize: 36, color: colores.borde, marginRight: 4 },
    estrellaActiva: { color: colores.acento },
    boton: {
      backgroundColor: colores.acento, padding: 16, borderRadius: 10,
      alignItems: 'center', marginTop: 12
    },
    botonDesactivado: { backgroundColor: '#666' },
    botonTexto: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  });
}