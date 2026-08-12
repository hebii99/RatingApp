import { Colores, useTema } from '@/contexts/TemaContext';
import { supabase } from '@/lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect } from 'expo-router';
import * as Sharing from 'expo-sharing';
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
import * as XLSX from 'xlsx';

// Argentina está en UTC-3 todo el año (no tiene horario de verano).
const OFFSET_ARGENTINA_HORAS = 3;

// Calcula el rango del mes en curso (día 1 00:00 a fin de mes 23:59:59
// hora Argentina), expresado en los mismos valores que Postgres guarda
// en `created_at` (en UTC, sin marca de zona horaria).
function obtenerLimitesMesArgentina() {
  const ahora = new Date();
  const argentinaAhora = new Date(ahora.getTime() - OFFSET_ARGENTINA_HORAS * 60 * 60 * 1000);

  const anio = argentinaAhora.getUTCFullYear();
  const mes = argentinaAhora.getUTCMonth();

  // Medianoche del día 1 en Argentina = 03:00 UTC del mismo día.
  const inicio = new Date(Date.UTC(anio, mes, 1, OFFSET_ARGENTINA_HORAS, 0, 0));
  // Medianoche del día 1 del mes siguiente en Argentina.
  const fin = new Date(Date.UTC(anio, mes + 1, 1, OFFSET_ARGENTINA_HORAS, 0, 0));

  return { inicio, fin };
}

// A qué día calendario (en Argentina) corresponde un created_at en UTC.
// Sirve para contar días distintos trabajados sin depender del formato
// de texto que tiene la columna `fecha` en calificaciones.
function diaArgentina(fechaUTC: string) {
  const fecha = new Date(new Date(fechaUTC).getTime() - OFFSET_ARGENTINA_HORAS * 60 * 60 * 1000);
  return `${fecha.getUTCFullYear()}-${fecha.getUTCMonth()}-${fecha.getUTCDate()}`;
}

// Redondea a 2 decimales — evita el clásico error de punto flotante de JS
// (ej: 0.1 + 0.2 = 0.30000000000000004) al sumar montos con centavos.
function redondear2(numero: number) {
  return Math.round((numero + Number.EPSILON) * 100) / 100;
}

const CATEGORIAS = [
  { clave: 'combustible', etiqueta: 'Combustible' },
  { clave: 'aceite', etiqueta: 'Aceite' },
  { clave: 'mecanico', etiqueta: 'Mecánico' },
  { clave: 'seguro', etiqueta: 'Seguro' },
  { clave: 'otros', etiqueta: 'Otros' },
] as const;

type Categoria = typeof CATEGORIAS[number]['clave'];

interface Gasto {
  id: string;
  categoria: Categoria;
  monto: number;
  fecha: string;
  nota: string | null;
}

function etiquetaCategoria(clave: string) {
  return CATEGORIAS.find((c) => c.clave === clave)?.etiqueta ?? clave;
}

interface Ingreso {
  id: string;
  monto: number;
  fecha: string;
}

interface Kilometro {
  km_inicio: number;
  km_fin: number | null;
}

// Fecha de hoy en Argentina, formato AAAA-MM-DD (para precargar el campo de fecha).
function hoyArgentina() {
  const ahora = new Date();
  const argentinaAhora = new Date(ahora.getTime() - OFFSET_ARGENTINA_HORAS * 60 * 60 * 1000);
  const anio = argentinaAhora.getUTCFullYear();
  const mes = String(argentinaAhora.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(argentinaAhora.getUTCDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export default function Finanzas() {
  const { colores } = useTema();
  const styles = crearEstilos(colores);

  const [cargando, setCargando] = useState(true);
  const [refrescando, setRefrescando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [guardandoIngreso, setGuardandoIngreso] = useState(false);

  const [pedidosTotales, setPedidosTotales] = useState(0);
  const [diasTrabajados, setDiasTrabajados] = useState(0);
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [ingresos, setIngresos] = useState<Ingreso[]>([]);
  const [kilometros, setKilometros] = useState<Kilometro[]>([]);

  const [categoriaElegida, setCategoriaElegida] = useState<Categoria>('combustible');
  const [monto, setMonto] = useState('');
  const [nota, setNota] = useState('');

  const [montoIngreso, setMontoIngreso] = useState('');
  const [fechaIngreso, setFechaIngreso] = useState(hoyArgentina());
  const [mostrarDetalleGastos, setMostrarDetalleGastos] = useState(false);
  const [mostrarDetalleIngresos, setMostrarDetalleIngresos] = useState(false);
  const [exportando, setExportando] = useState(false);

  const cargar = useCallback(async () => {
    const { inicio, fin } = obtenerLimitesMesArgentina();

    const [resultadoCalificaciones, resultadoGastos, resultadoIngresos, resultadoKilometros] = await Promise.all([
      supabase
        .from('calificaciones')
        .select('created_at')
        .gte('created_at', inicio.toISOString())
        .lt('created_at', fin.toISOString()),
      supabase
        .from('gastos')
        .select('id, categoria, monto, fecha, nota')
        .gte('fecha', inicio.toISOString().slice(0, 10))
        .lt('fecha', fin.toISOString().slice(0, 10))
        .order('fecha', { ascending: false }),
      supabase
        .from('ingresos')
        .select('id, monto, fecha')
        .gte('fecha', inicio.toISOString().slice(0, 10))
        .lt('fecha', fin.toISOString().slice(0, 10))
        .order('fecha', { ascending: false }),
      supabase
        .from('kilometros')
        .select('km_inicio, km_fin')
        .gte('fecha', inicio.toISOString().slice(0, 10))
        .lt('fecha', fin.toISOString().slice(0, 10)),
    ]);

    if (!resultadoCalificaciones.error && resultadoCalificaciones.data) {
      const filas = resultadoCalificaciones.data;
      setPedidosTotales(filas.length);
      const diasDistintos = new Set(filas.map((f) => diaArgentina(f.created_at)));
      setDiasTrabajados(diasDistintos.size);
    }

    if (!resultadoGastos.error && resultadoGastos.data) {
      setGastos(resultadoGastos.data as Gasto[]);
    } else if (resultadoGastos.error) {
      console.log('FINANZAS - error al traer gastos:', resultadoGastos.error);
    }

    if (!resultadoIngresos.error && resultadoIngresos.data) {
      setIngresos(resultadoIngresos.data as Ingreso[]);
    } else if (resultadoIngresos.error) {
      console.log('FINANZAS - error al traer ingresos:', resultadoIngresos.error);
    }

    if (!resultadoKilometros.error && resultadoKilometros.data) {
      setKilometros(resultadoKilometros.data as Kilometro[]);
    } else if (resultadoKilometros.error) {
      console.log('FINANZAS - error al traer kilometros:', resultadoKilometros.error);
    }

    setCargando(false);
    setRefrescando(false);
  }, []);

  useFocusEffect(useCallback(() => { cargar(); }, [cargar]));

  const onRefresh = () => {
    setRefrescando(true);
    cargar();
  };

  const totalGastado = redondear2(gastos.reduce((acc, g) => acc + g.monto, 0));
  const totalIngresado = redondear2(ingresos.reduce((acc, i) => acc + i.monto, 0));
  const totalKmRecorridos = redondear2(kilometros.reduce(
    (acc, k) => acc + (k.km_fin != null ? k.km_fin - k.km_inicio : 0), 0
  ));

  const totalesPorCategoria = CATEGORIAS.map((c) => ({
    ...c,
    total: redondear2(gastos.filter((g) => g.categoria === c.clave).reduce((acc, g) => acc + g.monto, 0)),
  })).filter((c) => c.total > 0);

  const eliminarGasto = (id: string) => {
    Alert.alert('Eliminar', '¿Seguro que querés eliminar este gasto?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('gastos').delete().eq('id', id);
          cargar();
        }
      }
    ]);
  };

  const guardarGasto = async () => {
    const montoNumerico = Number(monto.replace(',', '.'));

    if (!monto || Number.isNaN(montoNumerico) || montoNumerico <= 0) {
      Alert.alert('Monto inválido', 'Ingresá un monto mayor a 0.');
      return;
    }

    setGuardando(true);

    const { error } = await supabase.from('gastos').insert({
      categoria: categoriaElegida,
      monto: montoNumerico,
      nota: nota.trim() ? nota.trim() : null,
    });

    setGuardando(false);

    if (error) {
      console.log('FINANZAS - error al guardar gasto:', error);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo en un momento.');
      return;
    }

    setMonto('');
    setNota('');
    cargar();
  };

  // Carga el ingreso del día en el formulario para corregirlo antes de volver a guardar.
  const editarIngreso = (i: Ingreso) => {
    setFechaIngreso(i.fecha);
    setMontoIngreso(String(i.monto));
  };

  const eliminarIngreso = (id: string) => {
    Alert.alert('Eliminar', '¿Seguro que querés eliminar este ingreso?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          await supabase.from('ingresos').delete().eq('id', id);
          cargar();
        }
      }
    ]);
  };

  const reiniciarIngresosMes = () => {
    Alert.alert(
      'Reiniciar ingresos del mes',
      'Esto borra TODOS los ingresos cargados este mes. No se puede deshacer. ¿Confirmás?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Reiniciar', style: 'destructive', onPress: async () => {
            const { inicio, fin } = obtenerLimitesMesArgentina();
            await supabase
              .from('ingresos')
              .delete()
              .gte('fecha', inicio.toISOString().slice(0, 10))
              .lt('fecha', fin.toISOString().slice(0, 10));
            cargar();
          }
        }
      ]
    );
  };

  const guardarIngreso = async () => {
    const montoNumerico = Number(montoIngreso.replace(',', '.'));

    if (!montoIngreso || Number.isNaN(montoNumerico) || montoNumerico <= 0) {
      Alert.alert('Monto inválido', 'Ingresá un monto mayor a 0.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaIngreso)) {
      Alert.alert('Fecha inválida', 'Usá el formato AAAA-MM-DD.');
      return;
    }

    setGuardandoIngreso(true);

    // Un ingreso por día: si ya existe uno para esa fecha, lo pisa (sirve para corregir typos).
    const { error } = await supabase
      .from('ingresos')
      .upsert({ monto: montoNumerico, fecha: fechaIngreso }, { onConflict: 'user_id,fecha' });

    setGuardandoIngreso(false);

    if (error) {
      console.log('FINANZAS - error al guardar ingreso:', error);
      Alert.alert('No se pudo guardar', 'Intentá de nuevo en un momento.');
      return;
    }

    setMontoIngreso('');
    setFechaIngreso(hoyArgentina());
    cargar();
  };

  const gastoPorCategoria = (clave: Categoria) =>
    redondear2(gastos.filter((g) => g.categoria === clave).reduce((acc, g) => acc + g.monto, 0));

  const exportarMes = async () => {
    setExportando(true);
    try {
      const ahora = new Date();
      const argentinaAhora = new Date(ahora.getTime() - OFFSET_ARGENTINA_HORAS * 60 * 60 * 1000);
      const etiquetaMesCruda = argentinaAhora.toLocaleString('es-AR', { month: 'long', year: 'numeric' });
      const etiquetaMes = etiquetaMesCruda.charAt(0).toUpperCase() + etiquetaMesCruda.slice(1);

      const neto = redondear2(totalIngresado - totalGastado);
      const promedioPorPedido = pedidosTotales > 0 ? Math.round(totalIngresado / pedidosTotales) : 0;
      const promedioPorDia = diasTrabajados > 0 ? Math.round(totalIngresado / diasTrabajados) : 0;

      const filasResumen = [
        [`RESUMEN — ${etiquetaMes}`],
        [],
        ['Generado (app de repartos)', totalIngresado],
        [],
        ['Gastos'],
        ...CATEGORIAS.map((c) => [`  ${c.etiqueta}`, gastoPorCategoria(c.clave)]),
        ['  Total gastos', totalGastado],
        [],
        ['NETO', neto],
        [],
        ['Días trabajados', diasTrabajados],
        ['Pedidos entregados', pedidosTotales],
        ['Promedio por pedido', promedioPorPedido],
        ['Promedio por día', promedioPorDia],
      ];

      const filasCategorias = [
        ['Categoría', 'Monto'],
        ...CATEGORIAS.map((c) => [c.etiqueta, gastoPorCategoria(c.clave)]),
      ];

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasResumen), 'Resumen');
      XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasCategorias), 'Gastos por categoría');

      const base64 = XLSX.write(libro, { type: 'base64', bookType: 'xlsx' });
      const nombreArchivo = `finanzas_${argentinaAhora.getUTCFullYear()}-${String(argentinaAhora.getUTCMonth() + 1).padStart(2, '0')}.xlsx`;
      const tipoXlsx = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const ruta = FileSystem.documentDirectory + nombreArchivo;
      await FileSystem.writeAsStringAsync(ruta, base64, { encoding: FileSystem.EncodingType.Base64 });

      const disponible = await Sharing.isAvailableAsync();
      if (!disponible) {
        Alert.alert('No disponible', 'No se puede compartir archivos en este dispositivo.');
        return;
      }

      await Sharing.shareAsync(ruta, { mimeType: tipoXlsx, dialogTitle: `Guardar finanzas — ${etiquetaMes}` });
    } catch (error) {
      console.log('FINANZAS - error al exportar:', error);
      Alert.alert('No se pudo exportar', 'Intentá de nuevo en un momento.');
    } finally {
      setExportando(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={refrescando} onRefresh={onRefresh} tintColor={colores.acento} />
      }
    >
      <Text style={styles.titulo}>Finanzas</Text>
      <Text style={styles.subtitulo}>Resumen del mes en curso</Text>

      {cargando ? (
        <View style={styles.card}>
          <ActivityIndicator size="large" color={colores.acento} />
        </View>
      ) : (
        <View style={styles.gridResumen}>
          <View style={[styles.card, styles.cardResumen]}>
            <Text style={styles.numero} numberOfLines={1} adjustsFontSizeToFit>${totalIngresado}</Text>
            <Text style={styles.numeroLabel}>generado este mes</Text>
          </View>
          <View style={[styles.card, styles.cardResumen]}>
            <Text style={styles.numero} numberOfLines={1} adjustsFontSizeToFit>${totalGastado}</Text>
            <Text style={styles.numeroLabel}>gastado este mes</Text>
          </View>
          <View style={[styles.card, styles.cardResumen]}>
            <Text style={styles.numero} numberOfLines={1} adjustsFontSizeToFit>{diasTrabajados}</Text>
            <Text style={styles.numeroLabel}>días trabajados</Text>
          </View>
          <View style={[styles.card, styles.cardResumen]}>
            <Text style={styles.numero} numberOfLines={1} adjustsFontSizeToFit>{pedidosTotales}</Text>
            <Text style={styles.numeroLabel}>pedidos entregados</Text>
          </View>
          <View style={[styles.card, styles.cardResumen]}>
            <Text style={styles.numero} numberOfLines={1} adjustsFontSizeToFit>{totalKmRecorridos} km</Text>
            <Text style={styles.numeroLabel}>recorridos este mes</Text>
          </View>
        </View>
      )}

      {totalesPorCategoria.length > 0 && (
        <>
          <Text style={[styles.titulo, styles.tituloSeccion]}>Por categoría</Text>
          <View style={styles.card}>
            {totalesPorCategoria.map((c) => (
              <View key={c.clave} style={styles.filaCategoria}>
                <Text style={styles.filaCategoriaTexto}>{c.etiqueta}</Text>
                <Text style={styles.filaCategoriaMonto}>${c.total}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <TouchableOpacity
        style={[styles.boton, styles.botonSecundario]}
        onPress={exportarMes}
        disabled={exportando || cargando}
      >
        {exportando ? (
          <ActivityIndicator color={colores.acento} />
        ) : (
          <Text style={[styles.botonTexto, styles.botonTextoSecundario]}>Descargar detalles</Text>
        )}
      </TouchableOpacity>

      <Text style={[styles.titulo, styles.tituloSeccion]}>Cargar ingreso del día</Text>
      <Text style={styles.subtitulo}>Poné el total que muestra la app de repartos. Tocá un ingreso de la lista para corregirlo.</Text>

      <TextInput
        style={styles.input}
        placeholder="Fecha (AAAA-MM-DD)"
        placeholderTextColor={colores.textoSecundario}
        value={fechaIngreso}
        onChangeText={setFechaIngreso}
      />

      <TextInput
        style={styles.input}
        placeholder="Monto"
        placeholderTextColor={colores.textoSecundario}
        keyboardType="decimal-pad"
        value={montoIngreso}
        onChangeText={setMontoIngreso}
      />

      <TouchableOpacity
        style={styles.boton}
        onPress={guardarIngreso}
        disabled={guardandoIngreso}
      >
        {guardandoIngreso ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.botonTexto}>Guardar ingreso</Text>
        )}
      </TouchableOpacity>

      {ingresos.length > 0 && (
        <TouchableOpacity onPress={reiniciarIngresosMes}>
          <Text style={styles.enlacePeligro}>Reiniciar ingresos del mes</Text>
        </TouchableOpacity>
      )}

      <Text style={[styles.titulo, styles.tituloSeccion]}>Cargar gasto</Text>

      <View style={styles.chips}>
        {CATEGORIAS.map((c) => (
          <TouchableOpacity
            key={c.clave}
            onPress={() => setCategoriaElegida(c.clave)}
            style={[
              styles.chip,
              categoriaElegida === c.clave && { backgroundColor: colores.acento, borderColor: colores.acento },
            ]}
          >
            <Text
              style={[
                styles.chipTexto,
                categoriaElegida === c.clave && { color: '#ffffff' },
              ]}
            >
              {c.etiqueta}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TextInput
        style={styles.input}
        placeholder="Monto"
        placeholderTextColor={colores.textoSecundario}
        keyboardType="decimal-pad"
        value={monto}
        onChangeText={setMonto}
      />

      <TextInput
        style={styles.input}
        placeholder="Nota (opcional)"
        placeholderTextColor={colores.textoSecundario}
        value={nota}
        onChangeText={setNota}
      />

      <TouchableOpacity
        style={styles.boton}
        onPress={guardarGasto}
        disabled={guardando}
      >
        {guardando ? (
          <ActivityIndicator color="#ffffff" />
        ) : (
          <Text style={styles.botonTexto}>Guardar gasto</Text>
        )}
      </TouchableOpacity>

      <View style={styles.encabezadoSeccion}>
        <Text style={[styles.titulo, styles.tituloSeccion, { marginTop: 0 }]}>Detalle de ingresos</Text>
        {ingresos.length > 0 && (
          <TouchableOpacity onPress={() => setMostrarDetalleIngresos((v) => !v)}>
            <Text style={styles.enlace}>{mostrarDetalleIngresos ? 'Ocultar' : `Ver más (${ingresos.length})`}</Text>
          </TouchableOpacity>
        )}
      </View>

      {ingresos.length === 0 && !cargando ? (
        <Text style={styles.subtitulo}>Todavía no cargaste ingresos este mes.</Text>
      ) : mostrarDetalleIngresos ? (
        ingresos.map((i) => (
          <TouchableOpacity key={i.id} style={styles.filaGasto} onPress={() => editarIngreso(i)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filaGastoFecha}>{i.fecha}</Text>
            </View>
            <View style={styles.filaGastoDerecha}>
              <Text style={styles.filaGastoMonto}>${i.monto}</Text>
              <TouchableOpacity style={styles.botonEliminar} onPress={() => eliminarIngreso(i.id)}>
                <Text style={styles.botonEliminarTexto}>✕</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))
      ) : null}

      <View style={styles.encabezadoSeccion}>
        <Text style={[styles.titulo, styles.tituloSeccion, { marginTop: 0 }]}>Detalle de gastos</Text>
        {gastos.length > 0 && (
          <TouchableOpacity onPress={() => setMostrarDetalleGastos((v) => !v)}>
            <Text style={styles.enlace}>{mostrarDetalleGastos ? 'Ocultar' : `Ver más (${gastos.length})`}</Text>
          </TouchableOpacity>
        )}
      </View>

      {gastos.length === 0 && !cargando ? (
        <Text style={styles.subtitulo}>Todavía no cargaste gastos este mes.</Text>
      ) : mostrarDetalleGastos ? (
        gastos.map((g) => (
          <View key={g.id} style={styles.filaGasto}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filaGastoCategoria}>{etiquetaCategoria(g.categoria)}</Text>
              {g.nota ? <Text style={styles.filaGastoNota}>{g.nota}</Text> : null}
              <Text style={styles.filaGastoFecha}>{g.fecha}</Text>
            </View>
            <View style={styles.filaGastoDerecha}>
              <Text style={styles.filaGastoMonto}>${g.monto}</Text>
              <TouchableOpacity style={styles.botonEliminar} onPress={() => eliminarGasto(g.id)}>
                <Text style={styles.botonEliminarTexto}>✕</Text>
              </TouchableOpacity>
            </View>
          </View>
        ))
      ) : null}

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

function crearEstilos(colores: Colores) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colores.fondo, padding: 20, paddingTop: 60 },
    titulo: { fontSize: 24, fontWeight: 'bold', color: colores.texto, marginBottom: 4 },
    tituloSeccion: { marginTop: 28, fontSize: 18 },
    encabezadoSeccion: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28,
    },
    enlace: { color: colores.acento, fontSize: 14, fontWeight: 'bold' },
    enlacePeligro: { color: '#d9534f', fontSize: 13, marginTop: 10, textAlign: 'right' },
    subtitulo: { fontSize: 13, color: colores.textoSecundario, marginBottom: 24 },
    gridResumen: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
    card: {
      backgroundColor: colores.tarjeta, borderRadius: 16, padding: 20,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: 1, borderColor: colores.borde, minHeight: 110,
    },
    cardResumen: { width: '47%', padding: 14 },
    numero: { fontSize: 30, fontWeight: 'bold', color: colores.acento },
    numeroLabel: { fontSize: 14, color: colores.textoSecundario, marginTop: 8, textAlign: 'center' },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
    chip: {
      paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20,
      borderWidth: 1, borderColor: colores.borde, backgroundColor: colores.tarjeta,
    },
    chipTexto: { color: colores.texto, fontSize: 14 },
    input: {
      backgroundColor: colores.tarjeta, borderRadius: 12, padding: 14, marginTop: 12,
      borderWidth: 1, borderColor: colores.borde, color: colores.texto, fontSize: 15,
    },
    boton: {
      backgroundColor: colores.acento, borderRadius: 12, padding: 16,
      alignItems: 'center', marginTop: 16,
    },
    botonTexto: { color: '#ffffff', fontSize: 16, fontWeight: 'bold' },
    botonSecundario: {
      backgroundColor: 'transparent', borderWidth: 1, borderColor: colores.acento,
    },
    botonTextoSecundario: { color: colores.acento },
    filaCategoria: {
      flexDirection: 'row', justifyContent: 'space-between', width: '100%',
      paddingVertical: 8,
    },
    filaCategoriaTexto: { color: colores.texto, fontSize: 15 },
    filaCategoriaMonto: { color: colores.acento, fontSize: 15, fontWeight: 'bold' },
    filaGasto: {
      flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
      backgroundColor: colores.tarjeta, borderRadius: 12, padding: 14, marginTop: 10,
      borderWidth: 1, borderColor: colores.borde,
    },
    filaGastoCategoria: { color: colores.texto, fontSize: 15, fontWeight: 'bold' },
    filaGastoNota: { color: colores.textoSecundario, fontSize: 13, marginTop: 2 },
    filaGastoFecha: { color: colores.textoSecundario, fontSize: 12, marginTop: 4 },
    filaGastoMonto: { color: colores.acento, fontSize: 16, fontWeight: 'bold' },
    filaGastoDerecha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    botonEliminar: {
      width: 26, height: 26, borderRadius: 13,
      borderWidth: 1, borderColor: colores.acento, alignItems: 'center', justifyContent: 'center'
    },
    botonEliminarTexto: { color: colores.acento, fontSize: 13, fontWeight: 'bold' },
  });
}