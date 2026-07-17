import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';

// Lo que el usuario ELIGE en Ajustes.
export type Preferencia = 'claro' | 'oscuro' | 'auto';
// El resultado real que se termina usando para pintar la pantalla
// (cuando la preferencia es 'auto', esto depende del sistema operativo).
export type TemaEfectivo = 'claro' | 'oscuro';

export interface Colores {
  fondo: string;
  tarjeta: string;
  borde: string;
  texto: string;
  textoSecundario: string;
  acento: string;
}

const coloresOscuro: Colores = {
  fondo: '#111111',
  tarjeta: '#1e1e1e',
  borde: '#333333',
  texto: '#ffffff',
  textoSecundario: '#aaaaaa',
  acento: '#e53e3e',
};

const coloresClaro: Colores = {
  fondo: '#f5f5f5',
  tarjeta: '#ffffff',
  borde: '#e0e0e0',
  texto: '#111111',
  textoSecundario: '#666666',
  acento: '#e53e3e',
};

interface TemaContextType {
  preferencia: Preferencia;
  temaEfectivo: TemaEfectivo;
  colores: Colores;
  cambiarPreferencia: (nueva: Preferencia) => void;
  cargandoTema: boolean;
}

const TemaContext = createContext<TemaContextType | undefined>(undefined);
const CLAVE_STORAGE = 'ratingapp_tema';

export function TemaProvider({ children }: { children: ReactNode }) {
  // 'light' | 'dark' | null — lo que tiene configurado el celular ahora mismo.
  const esquemaSistema = useColorScheme();

  // Por defecto arranca en "auto": sigue al celular hasta que el usuario
  // elija algo manualmente en Ajustes.
  const [preferencia, setPreferencia] = useState<Preferencia>('auto');
  const [cargandoTema, setCargandoTema] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_STORAGE)
      .then((guardada) => {
        if (guardada === 'claro' || guardada === 'oscuro' || guardada === 'auto') {
          setPreferencia(guardada);
        }
      })
      .finally(() => setCargandoTema(false));
  }, []);

  const cambiarPreferencia = (nueva: Preferencia) => {
    setPreferencia(nueva);
    AsyncStorage.setItem(CLAVE_STORAGE, nueva).catch((err) =>
      console.warn('TEMA - no se pudo guardar la preferencia:', err)
    );
  };

  const temaEfectivo: TemaEfectivo =
    preferencia === 'auto'
      ? (esquemaSistema === 'dark' ? 'oscuro' : 'claro')
      : preferencia;

  const colores = temaEfectivo === 'oscuro' ? coloresOscuro : coloresClaro;

  return (
    <TemaContext.Provider
      value={{ preferencia, temaEfectivo, colores, cambiarPreferencia, cargandoTema }}
    >
      {children}
    </TemaContext.Provider>
  );
}

export function useTema() {
  const contexto = useContext(TemaContext);
  if (!contexto) throw new Error('useTema debe usarse dentro de <TemaProvider>');
  return contexto;
}