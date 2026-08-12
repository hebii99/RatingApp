import { Colores, useTema } from '@/contexts/TemaContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

// Argentina está en UTC-3 todo el año (no tiene horario de verano).
const OFFSET_ARGENTINA_HORAS = 3;

// Calcula el rango de "hoy" (00:00 a 23:59:59 hora Argentina), pero
// expresado en los mismos valores que Postgres guarda en `created_at`
// (que están en UTC, sin marca de zona horaria).
function obtenerLimitesHoyArgentina() {
  const ahora = new Date();
  const argentinaAhora = new Date(ahora.getTime() - OFFSET_ARGENTINA_HORAS * 60 * 60 * 1000);

  const anio = argentinaAhora.getUTCFullYear();
  const mes = argentinaAhora.getUTCMonth();
  const dia = argentinaAhora.getUTCDate();

  // Medianoche de hoy en Argentina = 03:00 UTC del mismo día.
  const inicio = new Date(Date.UTC(anio, mes, dia, OFFSET_ARGENTINA_HORAS, 0, 0));
  // Medianoche de mañana en Argentina = 03:00 UTC del día siguiente.
  const fin = new Date(Date.UTC(anio, mes, dia + 1, OFFSET_ARGENTINA_HORAS, 0, 0));

  return { inicio, fin };
}

// Fecha de hoy en Argentina, formato AAAA-MM-DD (misma fila de `kilometros` durante todo el día).
function hoyArgentina() {
  const ahora = new Date();
  const argentinaAhora = new Date(ahora.getTime() - OFFSET_ARGENTINA_HORAS * 60 * 60 * 1000);
  const anio = argentinaAhora.getUTCFullYear();
  const mes = String(argentinaAhora.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(argentinaAhora.getUTCDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export default function MisEntregas() {
  const { colores } = useTema();
  const styles = crearEstilos(colores);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [totalPropinas, setTotalPropinas] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

  const [kmInicioGuardado, setKmInicioGuardado] = useState<number | null>(null);
  const [kmFinGuardado, setKmFinGuardado] = useState<number | null>(null);
  const [kmInicioInput, setKmInicioInput] = useState('');
  const [kmFinInput, setKmFinInput] = useState('');
  const [guardandoKm, setGuardandoKm] = useState(false);

  const cargar = useCallback(async () => {
    const { inicio, fin } = obtenerLimitesHoyArgentina();

    // Una sola consulta: traemos el monto_propina de cada calificación de
    // hoy. La cantidad de entregas es la cantidad de filas, y el total de
    // propinas es la suma de esa columna (ignorando las que quedaron null).
    const { data, error } = await supabase
      .from('calificaciones')
      .select('monto_propina')
      .gte('created_at', inicio.toISOString())
      .lt('created_at', fin.toISOString());

    console.log('MIS ENTREGAS - filas:', data?.length, 'error:', error);

    if (!error && data) {
      setCantidad(data.length);
      const suma = data.reduce((acc, fila) => acc + (fila.monto_propina ?? 0), 0);
      setTotalPropinas(suma);
    }

    const { data: kmHoy, error: errorKm } = await supabase
      .from('kilometros')
      .select('km_inicio, km_fin')
      .eq('fecha', hoyArgentina())
      .maybeSingle();

    if (!errorKm) {
      setKmInicioGuardado(kmHoy?.km_inicio ?? null);
      setKmFinGuardado(kmHoy?.km_fin ?? null);
      setKmFinInput(kmHoy?.km_fin != null ? String(kmHoy.km_fin) : '');
    } else {
      console.log('MIS ENTREGAS - error al traer km:', errorKm);
    }

    setCargando(false);
    setRefrescando(false);
  }, []);

  const guardarKmInicio = async () => {
    const kmNumerico = Number(kmInicioInput.replace(',', '.'));

    if (!kmInicioInput || Number.isNaN(kmNumerico) || kmNumerico < 0) {
      Alert.alert('Km inválido', 'Ingresá el kilometraje del tablero.');
      return;
    }

    setGuardandoKm(true);

    const { error } = await supabase
      .from('kilometros')
      .upsert({ km_inicio: kmNumerico, fecha: hoyArgentina() }, { onConflict: 'user_id,fecha' });

    setGuardandoKm(false);

    if (error) {
      console.log('MIS ENTREGAS - error al guardar km inicio:', error);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo en un momento.');
      return;
    }

    setKmInicioInput('');
    cargar();
  };

  const guardarKmFin = async () => {
    const kmNumerico = Number(kmFinInput.replace(',', '.'));

    if (!kmFinInput || Number.isNaN(kmNumerico) || kmNumerico < 0) {
      Alert.alert('Km inválido', 'Ingresá el kilometraje del tablero.');
      return;
    }

    if (kmInicioGuardado != null && kmNumerico < kmInicioGuardado) {
      Alert.alert('Km inválido', 'El km actual no puede ser menor al km inicial.');
      return;
    }

    setGuardandoKm(true);

    // Acá siempre existe una fila (km_inicio ya está cargado), así que
    // actualizamos en vez de upsert: un upsert con solo km_fin fallaría
    // por la restricción not null de km_inicio al construir la fila.
    const { error } = await supabase
      .from('kilometros')
      .update({ km_fin: kmNumerico })
      .eq('fecha', hoyArgentina());

    setGuardandoKm(false);

    if (error) {
      console.log('MIS ENTREGAS - error al guardar km fin:', error);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo en un momento.');
      return;
    }

    cargar();
  };

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = () => {
    setRefrescando(true);
    cargar();
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={colores.acento} />
      }
    >
      <Text style={styles.titulo}>Mis entregas</Text>
      <Text style={styles.subtitulo}>Se reinicia todos los días a las 00:00</Text>

      <View style={styles.card}>
        {cargando ? (
          <ActivityIndicator size="large" color={colores.acento} />
        ) : (
          <>
            <Text style={styles.numero}>{cantidad}</Text>
            <Text style={styles.numeroLabel}>
              {cantidad === 1 ? 'entrega completada hoy' : 'entregas completadas hoy'}
            </Text>
          </>
        )}
      </View>

      <Text style={[styles.titulo, styles.tituloSeccion]}>Propinas</Text>

      <View style={styles.card}>
        {cargando ? (
          <ActivityIndicator size="large" color={colores.acento} />
        ) : (
          <>
            <Text style={styles.numero}>${totalPropinas ?? 0}</Text>
            <Text style={styles.numeroLabel}>en propinas hoy</Text>
          </>
        )}
      </View>

      <Text style={[styles.titulo, styles.tituloSeccion]}>Km recorridos</Text>

      {kmInicioGuardado == null ? (
        <>
          <Text style={styles.subtitulo}>Cargá el km que marca el tablero al empezar tu horario.</Text>
          <TextInput
            style={styles.input}
            placeholder="Km inicial"
            placeholderTextColor={colores.textoSecundario}
            keyboardType="decimal-pad"
            value={kmInicioInput}
            onChangeText={setKmInicioInput}
          />
          <TouchableOpacity style={styles.boton} onPress={guardarKmInicio} disabled={guardandoKm}>
            {guardandoKm ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.botonTexto}>Guardar km inicial</Text>
            )}
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Text style={styles.subtitulo}>Km inicial de hoy: {kmInicioGuardado}. Actualizá el km actual cuando quieras.</Text>
          <TextInput
            style={styles.input}
            placeholder="Km actual"
            placeholderTextColor={colores.textoSecundario}
            keyboardType="decimal-pad"
            value={kmFinInput}
            onChangeText={setKmFinInput}
          />
          <TouchableOpacity style={styles.boton} onPress={guardarKmFin} disabled={guardandoKm}>
            {guardandoKm ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.botonTexto}>{kmFinGuardado == null ? 'Guardar km' : 'Actualizar km'}</Text>
            )}
          </TouchableOpacity>

          {kmFinGuardado != null && (
            <View style={styles.card}>
              <Text style={styles.numero}>{kmFinGuardado - kmInicioGuardado} km</Text>
              <Text style={styles.numeroLabel}>recorridos hoy</Text>
            </View>
          )}
        </>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colores.fondo, padding: 20, paddingTop: 60 },
    titulo: { fontSize: 24, fontWeight: 'bold', color: colores.texto, marginBottom: 4 },
    tituloSeccion: { marginTop: 28, fontSize: 18 },
    subtitulo: { fontSize: 13, color: colores.textoSecundario, marginBottom: 24 },
    card: {
      backgroundColor: colores.tarjeta, borderRadius: 16, padding: 32,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colores.borde, minHeight: 160, marginTop: 12
    },
    numero: { fontSize: 56, fontWeight: 'bold', color: colores.acento },
    numeroLabel: { fontSize: 14, color: colores.textoSecundario, marginTop: 8 },
    input: {
      backgroundColor: colores.tarjeta, borderRadius: 12, padding: 14, marginTop: 4,
      borderWidth: 1, borderColor: colores.borde, color: colores.texto, fontSize: 15,
    },
    boton: {
      backgroundColor: colores.acento, borderRadius: 12, padding: 16,
      alignItems: 'center', marginTop: 16,
    },
    botonTexto: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
  });
}