import { useAuth } from '@/contexts/AuthContext';
import { Preferencia, useTema } from '@/contexts/TemaContext';
import { Modal, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const OPCIONES: { valor: Preferencia; etiqueta: string }[] = [
  { valor: 'claro', etiqueta: 'Claro' },
  { valor: 'oscuro', etiqueta: 'Oscuro' },
  { valor: 'auto', etiqueta: 'Automático' },
];

export function AjustesModal({ visible, onClose }: Props) {
  const { colores, preferencia, cambiarPreferencia } = useTema();
  const { signOut } = useAuth();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {/* Tocar el fondo oscurecido cierra el panel */}
      <Pressable style={styles.fondo} onPress={onClose}>
        {/* Tocar adentro del panel NO lo cierra */}
        <Pressable
          style={[styles.hoja, { backgroundColor: colores.tarjeta, borderColor: colores.borde }]}
          onPress={() => {}}
        >
          <View style={styles.manija} />
          <Text style={[styles.titulo, { color: colores.texto }]}>Ajustes</Text>

          <Text style={[styles.subtitulo, { color: colores.textoSecundario }]}>Tema</Text>
          <View style={styles.opcionesFila}>
            {OPCIONES.map((op) => {
              const activa = preferencia === op.valor;
              return (
                <TouchableOpacity
                  key={op.valor}
                  style={[
                    styles.opcionChip,
                    { borderColor: colores.borde, backgroundColor: colores.fondo },
                    activa && { backgroundColor: colores.acento, borderColor: colores.acento },
                  ]}
                  onPress={() => cambiarPreferencia(op.valor)}
                >
                  <Text
                    style={[
                      styles.opcionTexto,
                      { color: colores.textoSecundario },
                      activa && { color: '#fff', fontWeight: 'bold' },
                    ]}
                  >
                    {op.etiqueta}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {preferencia === 'auto' && (
            <Text style={[styles.ayuda, { color: colores.textoSecundario }]}>
              Sigue el modo oscuro/claro configurado en tu celular
            </Text>
          )}

          <TouchableOpacity onPress={() => { onClose(); signOut(); }} style={styles.botonSalir}>
            <Text style={styles.botonSalirTexto}>Cerrar sesión</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  hoja: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    padding: 24, paddingBottom: 40, borderWidth: 1, borderBottomWidth: 0,
  },
  manija: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#666', alignSelf: 'center', marginBottom: 20 },
  titulo: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  subtitulo: { fontSize: 13, marginBottom: 8 },
  opcionesFila: { flexDirection: 'row', gap: 8 },
  opcionChip: {
    flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center',
  },
  opcionTexto: { fontSize: 13 },
  ayuda: { fontSize: 12, marginTop: 8, fontStyle: 'italic' },
  botonSalir: { marginTop: 28, backgroundColor: '#e53e3e', borderRadius: 10, padding: 14, alignItems: 'center' },
  botonSalirTexto: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
});