/*
 * El borrador del servidor (spec §4.3, capa 2; decisión B5). La capa 1
 * —IndexedDB, cada tecla— es de la fase 6; esta es la que hace que lo que
 * ella escribió a medias sobreviva a cambiar de aparato, y la que permite
 * el aviso de «tu hermana está editando desde hace diez minutos».
 *
 * Vive en `refs/panel/borrador`, FUERA de `refs/heads/`: la plataforma solo
 * mira ramas para decidir si dispara un deploy, así que este ref no
 * despliega nada, no ensucia la lista de ramas, y no hay nada que
 * configurar en ningún tablero (decisión B5 — borró una pregunta abierta
 * entera del spec).
 *
 * No tiene historia que preservar —es «lo último que ella escribió», no una
 * serie de commits que alguien vaya a revisar— así que cada guardado
 * reemplaza al anterior con `force: true`. Es la ÚNICA excepción de todo el
 * proyecto a la regla de `force: false`, y por eso está encerrada acá
 * adentro y en un solo lugar de `publicar.ts` (la guardia que tira si
 * `forzar` llega junto con `main`): nada de este archivo, ni de ningún otro,
 * puede mover `main` con force.
 *
 * Puro e inyectable (regla de `src/servidor/**`): recibe el cliente de
 * GitHub ya armado y el reloj (`ahora`) por parámetro. No lee `process.env`
 * ni toca `globalThis.fetch`.
 */
import { cliente } from './github'
import { publica, AUTOR_PANEL } from './publicar'

/** El ref, sin el prefijo `refs/` —la misma forma que usa todo `github.ts` (`heads/main`, nunca `refs/heads/main`). */
export const REF_BORRADOR = 'panel/borrador'

/** La única ruta que este ref conoce. */
export const RUTA_BORRADOR = 'panel/borrador.json'

/**
 * El sha del árbol VACÍO: una constante universal de git (el hash de «cero
 * entradas»), igual en cualquier repositorio, no algo de este proyecto en
 * particular. Sirve de `base_tree` para el PRIMER borrador de la vida del
 * panel: en ese momento no hay ningún commit propio del que partir, y este
 * valor le dice a la Git Data API «un árbol nuevo, de cero», sin tener que
 * inventar ni pedir prestado el árbol de otro ref.
 */
const ARBOL_VACIO = '4b825dc642cb6eb9a060e54bf8d69288fbee4904'

export interface Borrador {
  /** Los documentos a medio editar, con la misma forma que `publicar`. */
  documentos: Record<string, unknown>
  /** El sha del sitio contra el que se escribió. */
  base: string
  /** Qué aparato lo escribió, para el aviso de conflicto (spec §4.3). */
  dispositivo: string
  /** Quién, para «tu hermana está editando desde hace diez minutos». */
  autor: string
  /** Epoch ms. */
  hora: number
}

export type ResultadoGuardado =
  | { ok: true }
  | {
      ok: false
      motivo: 'hay-uno-mas-nuevo'
      /** El borrador que YA estaba ahí, y que este guardado no pisó. */
      otro: { dispositivo: string; hora: number }
    }
  | { ok: false; motivo: 'no-se-pudo-guardar'; problema: string }

/** ¿Este error de `github.ts` es un 404? La forma es la que arma `cliente()` (`GitHub respondió 404: ...`). */
function es404(e: unknown): boolean {
  return e instanceof Error && /^GitHub respondió 404:/.test(e.message)
}

/**
 * Lee el ref y, si existe, el borrador que tiene adentro. Un solo lugar
 * para las dos cosas que hacen falta juntas: `leeBorrador()` (la acción
 * `borrador.leer`) solo necesita el borrador, pero `guarda()` necesita
 * TAMBIÉN el sha del ref —para saber si tiene que crearlo o moverlo, y para
 * no leerlo dos veces—.
 */
async function intentaLeer(gh: ReturnType<typeof cliente>): Promise<{ sha: string; borrador: Borrador } | null> {
  try {
    const { sha } = await gh.ref(REF_BORRADOR)
    const texto = await gh.archivoEnRef(RUTA_BORRADOR, sha)
    return { sha, borrador: JSON.parse(texto) as Borrador }
  } catch (e) {
    // [Producto] Es el estado normal de un panel recién estrenado, o de
    // cualquier sesión antes del primer guardado: nadie escribió un
    // borrador todavía. Un error acá —la primera pantalla que ella ve en
    // su vida— sería peor que simplemente no tener nada que mostrarle.
    if (es404(e)) return null
    throw e
  }
}

/** Lee el borrador guardado, o `null` si nadie guardó ninguno todavía. Nunca compara ni decide: eso es de la fase 6 (ver el docstring de `guarda`). */
export async function leeBorrador(gh: ReturnType<typeof cliente>): Promise<Borrador | null> {
  const actual = await intentaLeer(gh)
  return actual ? actual.borrador : null
}

export interface DatosParaGuardar {
  documentos: Record<string, unknown>
  base: string
  dispositivo: string
  autor: string
  ahora: number
  /** Si hay que pisar el borrador de OTRO aparato aunque sea más nuevo. Default `false`. */
  pisar?: boolean
}

/**
 * Guarda el borrador del servidor. NO resuelve ningún conflicto: escribe lo
 * que le llega, y lo único que decide por su cuenta es si hay que CREAR el
 * ref (primera vez) o MOVERLO (ya existía) — nunca qué preguntarle a ella
 * sobre el contenido. Esa pantalla («celular, ayer 11:04, 3 cambios» / «esta
 * compu, hace 6 días, 1 cambio», spec §4.3) es de la fase 6; `borrador.leer`
 * (acciones.ts) le da el borrador del servidor tal cual para que la arme.
 *
 * Lo único que SÍ hace acá, porque perder trabajo en silencio es el único
 * resultado inaceptable (mismo criterio que la Tarea 2 aplicó a publicar):
 * si YA hay un borrador de OTRO dispositivo y es MÁS NUEVO que `ahora`, este
 * guardado se rechaza —sin escribir nada— salvo que venga `pisar: true`. Un
 * borrador del MISMO dispositivo nunca se rechaza a sí mismo (es la
 * autoguardada normal de la fase 6, tecla tras tecla).
 */
export async function guarda(gh: ReturnType<typeof cliente>, args: DatosParaGuardar): Promise<ResultadoGuardado> {
  const actual = await intentaLeer(gh)

  if (actual && !args.pisar && actual.borrador.dispositivo !== args.dispositivo && actual.borrador.hora > args.ahora) {
    return { ok: false, motivo: 'hay-uno-mas-nuevo', otro: { dispositivo: actual.borrador.dispositivo, hora: actual.borrador.hora } }
  }

  const contenido = JSON.stringify({
    documentos: args.documentos,
    base: args.base,
    dispositivo: args.dispositivo,
    autor: args.autor,
    hora: args.ahora,
  } satisfies Borrador)

  if (actual === null) {
    // [Tarea 11] El ref no existe hasta que alguien guarda por primera vez
    // en la vida del panel. `publica()` no sirve para ESTE paso —su
    // `intento()` arranca leyendo el ref, y leer un ref que no existe
    // todavía es 404—, así que el bootstrap se arma a mano: un blob, un
    // árbol de un solo archivo sobre el ÁRBOL VACÍO (nunca sobre el de
    // `main`: el árbol del borrador lleva SOLO `panel/borrador.json`), un
    // commit RAÍZ —sin padre, porque no hay de qué descender— y recién ahí
    // el ref se CREA. Sin este camino, el primer borrador de la vida del
    // panel moriría con un 404 que no le dice nada a nadie — y es el
    // primer borrador, o sea el peor momento para eso.
    const shaDelBlob = await gh.creaBlob(contenido)
    const shaDelArbol = await gh.creaArbol(ARBOL_VACIO, [{ path: RUTA_BORRADOR, sha: shaDelBlob }])
    const shaDelCommit = await gh.creaCommit({ mensaje: 'Borrador', arbol: shaDelArbol, padre: '', autor: AUTOR_PANEL })
    await gh.creaRef(REF_BORRADOR, shaDelCommit)
    return { ok: true }
  }

  // Ya existe: de acá en más es una publicación cualquiera, nomás que al
  // ref del borrador y con `forzar: true` — reusa TODA la mecánica de
  // `publica()` (un commit, o ninguno; nunca a medio escribir) en vez de
  // repetirla a mano.
  const r = await publica(gh, {
    archivos: [{ ruta: RUTA_BORRADOR, contenido }],
    autor: args.autor,
    ref: REF_BORRADOR,
    forzar: true,
  })
  return r.ok ? { ok: true } : { ok: false, motivo: 'no-se-pudo-guardar', problema: r.problema }
}
