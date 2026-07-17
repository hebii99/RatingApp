import { Colores, useTema } from '@/contexts/TemaContext';
import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
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

export default function MisEntregas() {
  const { colores } = useTema();
  const styles = crearEstilos(colores);
  const [cantidad, setCantidad] = useState<number | null>(null);
  const [totalPropinas, setTotalPropinas] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);

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

    setCargando(false);
    setRefrescando(false);
  }, []);

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
  });
}