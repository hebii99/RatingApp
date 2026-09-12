// A veces, en el arranque en frío de Android, la primera consulta de red a
// Supabase no devuelve ni datos ni error: queda colgada para siempre (un
// problema conocido de React Native, no algo que hicimos mal en el código).
// Cerrar y volver a abrir la app "de nuevo" suele arreglarlo porque le da al
// teléfono una segunda oportunidad ya con la red bien inicializada. Esta
// función hace ese reintento automáticamente, sin que el usuario tenga que
// cerrar la app: si una consulta no responde a tiempo, la abandona y la
// vuelve a intentar desde cero.
const TIEMPO_ESPERA_MS = 4000;
const REINTENTOS = 2;

type RespuestaSupabase<T> = { data: T | null; error: any };

export async function consultarConReintento<T>(
  consulta: () => PromiseLike<RespuestaSupabase<T>>
): Promise<RespuestaSupabase<T>> {
  for (let intento = 0; intento <= REINTENTOS; intento++) {
    const resultado = await Promise.race([
      Promise.resolve(consulta()),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), TIEMPO_ESPERA_MS)),
    ]);

    if (resultado !== 'timeout') return resultado;

    console.log(`CONSULTA - se colgó, reintento ${intento + 1} de ${REINTENTOS}`);
  }

  return { data: null, error: { message: 'La consulta no respondió después de varios intentos.' } };
}
