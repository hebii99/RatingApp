import { supabase } from '@/lib/supabase';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';

const POR_PAGINA = 7;

export default function Historial() {
  const [calificaciones, setCalificaciones] = useState<any[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [pagina, setPagina] = useState(0);
  const scrollRef = useRef<ScrollView>(null);

  const irArriba = () => {
  scrollRef.current?.scrollTo({ y: 0, animated: true });
};

  const cargar = async () => {
  const { data, error } = await supabase
    .from('calificaciones')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('HISTORIAL - data:', data?.length, 'error:', error);

  if (!error && data) setCalificaciones(data);
};

  useFocusEffect(useCallback(() => { cargar(); }, []));

  // Si el usuario busca algo, volvemos a la primera página para no quedar
  // "perdidos" en una página que ya no tiene resultados.
  useEffect(() => {
    setPagina(0);
  }, [busqueda]);

  const eliminar = (id: string) => {
    Alert.alert('Eliminar', '¿Seguro que querés eliminar esta calificación?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('calificaciones').delete().eq('id', id);
          cargar();
        }
      }
    ]);
  };

  const Estrellas = ({ valor }: any) => (
    <Text style={styles.estrellas}>
      {[1,2,3,4,5].map(n => n <= valor ? '★' : '☆').join('')}
    </Text>
  );

  const filtradas = calificaciones.filter(c => {
    if (!busqueda) return true;
    const regex = new RegExp(busqueda.replace(/\*/g, '.*'), 'i');
    return regex.test(c.direccion);
  });

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const paginaSegura = Math.min(pagina, totalPaginas - 1);
  const visibles = filtradas.slice(
    paginaSegura * POR_PAGINA,
    paginaSegura * POR_PAGINA + POR_PAGINA
  );

  return (
    <ScrollView style={styles.container} ref={scrollRef}>
      <Text style={styles.titulo}>Historial</Text>

      <TextInput
        style={styles.buscador}
        placeholder="Buscar dirección..."
        placeholderTextColor="#666"
        value={busqueda}
        onChangeText={setBusqueda}
      />

      {filtradas.length === 0 && (
        <Text style={styles.vacio}>No hay calificaciones guardadas</Text>
      )}

      {visibles.map((c) => (
        <View key={c.id} style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.direccion}>📍 {c.direccion}</Text>
            <Text style={styles.fecha}>{c.fecha}</Text>
          </View>

          <Estrellas valor={c.calificacion} />

          <View style={styles.tags}>
            {c.acceso ? <Text style={styles.tag}>{c.acceso}</Text> : null}
            {c.trato ? <Text style={styles.tag}>{c.trato}</Text> : null}
            {c.propina ? <Text style={styles.tag}>Propina: {c.propina}</Text> : null}
            {c.peso ? <Text style={styles.tag}>{c.peso}</Text> : null}
            {c.repetir ? <Text style={styles.tag}>¿Repetir? {c.repetir}</Text> : null}
          </View>

          {c.seguridad > 0 && (
            <Text style={styles.seguridad}>
              Seguridad zona: {'★'.repeat(c.seguridad)}{'☆'.repeat(5 - c.seguridad)}
            </Text>
          )}

          {c.comentario ? (
            <Text style={styles.comentario}>💬 {c.comentario}</Text>
          ) : null}

          <TouchableOpacity style={styles.botonEliminar} onPress={() => eliminar(c.id)}>
            <Text style={styles.botonEliminarTexto}>Eliminar</Text>
          </TouchableOpacity>
        </View>
      ))}

      {filtradas.length > 0 && (
        <View style={styles.paginacion}>
          <TouchableOpacity
            style={[styles.botonPagina, paginaSegura === 0 && styles.botonPaginaDesactivado]}
            onPress={() => { setPagina(p => Math.max(0, p - 1)); irArriba(); }}
            disabled={paginaSegura === 0}
          >
            <Text style={styles.botonPaginaTexto}>‹ Anterior</Text>
          </TouchableOpacity>

          <Text style={styles.paginaTexto}>
            Página {paginaSegura + 1} de {totalPaginas}
          </Text>

          <TouchableOpacity
            style={[styles.botonPagina, paginaSegura >= totalPaginas - 1 && styles.botonPaginaDesactivado]}
            onPress={() => { setPagina(p => Math.min(totalPaginas - 1, p + 1)); irArriba(); }}
            disabled={paginaSegura >= totalPaginas - 1}
          >
            <Text style={styles.botonPaginaTexto}>Siguiente ›</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#111', padding: 20, paddingTop: 60 },
  titulo: { fontSize: 24, fontWeight: 'bold', color: '#fff', marginBottom: 24 },
  vacio: { color: '#666', textAlign: 'center', marginTop: 60, fontSize: 16 },
  buscador: {
    backgroundColor: '#1e1e1e', color: '#fff', borderRadius: 8,
    padding: 12, fontSize: 15, borderWidth: 1, borderColor: '#333',
    marginBottom: 20
  },
  card: {
    backgroundColor: '#1e1e1e', borderRadius: 12, padding: 16,
    marginBottom: 16, borderWidth: 1, borderColor: '#333'
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  direccion: { color: '#fff', fontWeight: 'bold', fontSize: 15, flex: 1 },
  fecha: { color: '#666', fontSize: 12 },
  estrellas: { color: '#e53e3e', fontSize: 22, marginBottom: 10 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: {
    backgroundColor: '#2a2a2a', color: '#aaa', fontSize: 12,
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12
  },
  seguridad: { color: '#aaa', fontSize: 13, marginBottom: 6 },
  comentario: { color: '#bbb', fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  botonEliminar: {
    marginTop: 12, padding: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#e53e3e', alignItems: 'center'
  },
  botonEliminarTexto: { color: '#e53e3e', fontSize: 13 },
  paginacion: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginTop: 8, marginBottom: 8,
  },
  botonPagina: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: '#444',
  },
  botonPaginaDesactivado: { opacity: 0.3 },
  botonPaginaTexto: { color: '#ccc', fontSize: 13, fontWeight: '600' },
  paginaTexto: { color: '#888', fontSize: 13 },
});