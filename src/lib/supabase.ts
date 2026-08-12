import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const SUPABASE_URL = 'https://sxvpumolwegjtyzodmoi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_Fi9qIFvQTooMLEFQsnOmvw_wO9kjnr0';

// En algunos cold-starts de Android, la primera lectura de AsyncStorage
// dentro del lock de autenticación de supabase-js se cuelga indefinidamente
// (nunca resuelve ni rechaza), lo que traba toda la app en la pantalla de
// carga. Este wrapper le pone un timeout a cada operación: si no responde
// a tiempo, se resuelve como si no hubiera nada guardado (o como no-op en
// setItem/removeItem) en vez de dejar la promesa colgada para siempre.
const TIMEOUT_MS = 3000;

function conTimeout<T>(promesa: Promise<T>, valorPorDefecto: T): Promise<T> {
  return new Promise((resolve) => {
    const temporizador = setTimeout(() => resolve(valorPorDefecto), TIMEOUT_MS);
    promesa
      .then((valor) => {
        clearTimeout(temporizador);
        resolve(valor);
      })
      .catch(() => {
        clearTimeout(temporizador);
        resolve(valorPorDefecto);
      });
  });
}

const storageConTimeout = {
  getItem: (clave: string) => conTimeout(AsyncStorage.getItem(clave), null),
  setItem: (clave: string, valor: string) => conTimeout(AsyncStorage.setItem(clave, valor), undefined),
  removeItem: (clave: string) => conTimeout(AsyncStorage.removeItem(clave), undefined),
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    storage: storageConTimeout,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});