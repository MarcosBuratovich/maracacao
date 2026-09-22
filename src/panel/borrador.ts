/*
 * El borrador (Tarea 3, fase 6): cada cambio va a memoria y, con retardo, a
 * `borrador.guardar`; al abrir, `borrador.leer` decide si hay que
 * preguntarle a ella cuál abrir.
 *
 * El acelerador es el mismo de toda la fase: `resume()` (`../contenido/diff`)
 * cuenta cuántos campos cambió un borrador contra lo publicado — la MISMA
 * cuenta que arma la bandeja de publicar (Tarea 4, `publicacion.ts`), para
 * que el número que ve acá y el que ve al publicar nunca se contradigan.
 *
 * Todo lo de acá es PURO e INYECTABLE (mismo criterio que `App.tsx`): las
 * transiciones de estado son funciones que reciben el resultado de una
 * acción de `./api` y devuelven el estado siguiente, sin tocar React ni el
 * reloj real. `Sesion.tsx` es la plomería mínima que las conecta a un
 * componente.
 *
 * El id de aparato (`idDeAparato()`, `./aparato.ts`) es deliberadamente
 * opaco — ese archivo dice con todas las letras que «no tiene forma de
 * saber si es un celular o una tablet prestada»—, así que ACÁ tampoco se
 * inventa un tipo de aparato: el texto que ella lee dice «otro aparato»,
 * nunca «tu celular» ni «esta compu» — eso sería inventar un dato que el
 * código no tiene (regla del proyecto: cero contenido inventado).
 */
import type { Borrador, OtroBorrador, ResultadoBorradorGuardar, ResultadoBorradorLeer } from './api'
import { resume } from '../contenido/diff'
import { DOCUMENTOS, type IdDocumento } from '../contenido/esquema'
import type { Documentos } from './campos'

/*
 * ---------------------------------------------------------------------
 * Cuántos cambios trae un borrador, y desde cuándo — el resumen que ella lee
 * ---------------------------------------------------------------------
 */

/**
 * Cuántos campos cambiaron entre lo publicado y un documento a medio
 * editar. Recorre los tres documentos con `resume()` — la misma función que
 * usa la bandeja de publicar (`publicacion.ts`) — así que esta cuenta y la
 * de ahí nunca se cuentan distinto.
 */
export function cuentaCambios(publicado: Documentos, otros: Partial<Documentos>): number {
  let total = 0
  for (const id of Object.keys(DOCUMENTOS) as IdDocumento[]) {
    if (!(id in otros)) continue
    total += resume(publicado[id], otros[id], DOCUMENTOS[id]).length
  }
  return total
}

/**
 * «hace un momento» / «hace 6 minutos» / «hace 3 horas» / «hace 6 días».
 *
 * A propósito SIN fecha de calendario («ayer», «el martes»): calcularla bien
 * exige saber en qué huso horario está leyendo ELLA, no el servidor, y un
 * «ayer» calculado con el huso equivocado es peor que uno más genérico pero
 * siempre cierto. `Math.max(0, ms)` porque un reloj de aparato adelantado
 * puede mandar una `hora` que, comparada contra `Date.now()` de acá, da
 * negativo — nunca «hace -3 minutos».
 */
export function haceCuanto(ms: number): string {
  const transcurrido = Math.max(0, ms)
  if (transcurrido < 60_000) return 'hace un momento'
  const minutos = Math.floor(transcurrido / 60_000)
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 24) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const dias = Math.floor(horas / 24)
  return `hace ${dias} ${dias === 1 ? 'día' : 'días'}`
}

/** «3 cambios» / «1 cambio». */
function cuentaCambiosTexto(n: number): string {
  return n === 1 ? '1 cambio' : `${n} cambios`
}

/**
 * El resumen de un borrador de OTRO aparato, para que ella decida si lo
 * abre: cuántos campos cambió y desde cuándo está ahí. «otro aparato,
 * hace 6 días, 1 cambio» — sin nombrar el tipo de aparato (ver el docstring
 * del módulo).
 */
export function resumenBorradorAjeno(borrador: Borrador, publicado: Documentos, ahora: number): string {
  const n = cuentaCambios(publicado, borrador.documentos as Partial<Documentos>)
  return `otro aparato, ${haceCuanto(ahora - borrador.hora)}, ${cuentaCambiosTexto(n)}`
}

/**
 * El resumen del borrador que GANÓ un guardado (motivo `hay-uno-mas-nuevo`
 * de `borrador.guardar`): solo trae `dispositivo`/`hora`, sin `documentos`
 * —`OtroBorrador` no los tiene—, así que acá no hay cambios que contar.
 */
export function resumenOtroBorrador(otro: OtroBorrador, ahora: number): string {
  return `otro aparato, ${haceCuanto(ahora - otro.hora)}`
}

/*
 * ---------------------------------------------------------------------
 * Al abrir: leer el borrador y decidir qué mostrar
 * ---------------------------------------------------------------------
 */

export type EstadoBorrador =
  | { fase: 'leyendo' }
  | { fase: 'error'; problema: string }
  /**
   * No hay nada que preguntar: o no había ningún borrador, o el que había
   * es de ESTE mismo aparato (se retoma solo, sin preguntar — es la
   * continuación de su propio trabajo, no una pisada de nadie).
   * `documentos`, cuando viene, es lo que hay que cargar en el editor.
   */
  | { fase: 'listo'; horaLeida: number | undefined; documentos: Record<string, unknown> | undefined }
  /** Hay un borrador de OTRO aparato: hay que preguntarle cuál abrir. */
  | { fase: 'conflicto'; borrador: Borrador }

/**
 * Traduce lo que devolvió `borrador.leer()` al estado que dibuja la
 * pantalla. `miDispositivo` es el id de ESTE aparato (`idDeAparato()`): el
 * único criterio para preguntar es que el `dispositivo` del borrador sea
 * DISTINTO — nunca comparar horas, eso es un juicio de producto que la
 * clienta hace, no el código.
 */
export function trasLeerBorrador(r: ResultadoBorradorLeer, miDispositivo: string): EstadoBorrador {
  if (!r.ok) return { fase: 'error', problema: r.problema }
  if (r.borrador === null) return { fase: 'listo', horaLeida: undefined, documentos: undefined }
  if (r.borrador.dispositivo === miDispositivo) {
    return { fase: 'listo', horaLeida: r.borrador.hora, documentos: r.borrador.documentos }
  }
  return { fase: 'conflicto', borrador: r.borrador }
}

export type EleccionConflicto = 'abrir-otro' | 'seguir-publicado'

/**
 * Qué pasa cuando ella elige, en la pantalla de conflicto. Las dos
 * opciones declaran `horaLeida: borrador.hora` por igual: elegir «seguir
 * desde lo publicado» no es lo mismo que no haber leído nada — ELLA VIO ese
 * borrador (llegó a preguntarle), así que su próximo guardado también
 * declara haberlo visto, aunque haya decidido no usar su contenido.
 */
export function resuelveConflicto(
  eleccion: EleccionConflicto,
  borrador: Borrador,
): { horaLeida: number; documentos: Record<string, unknown> | undefined } {
  return {
    horaLeida: borrador.hora,
    documentos: eleccion === 'abrir-otro' ? borrador.documentos : undefined,
  }
}

/*
 * ---------------------------------------------------------------------
 * El guardado automático: a memoria ya, al servidor con retardo
 * ---------------------------------------------------------------------
 */

/** Sin que ella toque nada durante esto, se guarda. */
export const RETARDO_GUARDADO_MS = 10_000

/**
 * Piso duro: aunque no pare de escribir, no puede pasar más de esto sin un
 * intento de guardado (spec §4.3). Sin este piso, un `RETARDO_GUARDADO_MS`
 * que se reinicia con cada tecla nunca dispara mientras ella no deje de
 * escribir — que es exactamente cuando más importa no perder nada.
 */
export const PISO_GUARDADO_MS = 30_000

export type ResultadoGuardadoTraducido =
  | { tipo: 'ok' }
  | { tipo: 'conflicto'; problema: string; otro: OtroBorrador }
  | { tipo: 'error'; problema: string }

/** Traduce `ResultadoBorradorGuardar` a lo que la pantalla necesita mostrar — la 409 «hay-uno-mas-nuevo» no se traga, se muestra. */
export function trasGuardar(r: ResultadoBorradorGuardar): ResultadoGuardadoTraducido {
  if (r.ok) return { tipo: 'ok' }
  if ('motivo' in r && r.motivo === 'hay-uno-mas-nuevo') {
    return { tipo: 'conflicto', problema: r.problema, otro: r.otro }
  }
  return { tipo: 'error', problema: r.problema }
}

export interface DependenciasAutoguardado {
  /** Nunca tira (mismo contrato que `borradorGuardar` de `./api`). */
  guardar: (
    documentos: Documentos,
    args: { horaLeida: number | undefined; pisar: boolean },
  ) => Promise<ResultadoBorradorGuardar>
  onResultado: (r: ResultadoGuardadoTraducido) => void
  /** Inyectable para los tests — nunca `setTimeout` global desde acá si se puede evitar la fuga. */
  fijaTemporizador?: typeof setTimeout
  limpiaTemporizador?: typeof clearTimeout
}

/**
 * El auto-guardado: acumula el último `documentos` que le anotaron y lo
 * manda a `borrador.guardar` después de `RETARDO_GUARDADO_MS` de silencio,
 * sin pasar nunca de `PISO_GUARDADO_MS` sin intentarlo.
 *
 * `horaLeida` se fija UNA vez —al terminar de leer el borrador, o al
 * resolver un conflicto— y no se toca después de cada guardado con éxito:
 * `guarda()` (`src/servidor/borrador.ts`) nunca rechaza un guardado del
 * MISMO aparato que ya tiene el borrador puesto ahí, así que una vez que
 * ESTE aparato guardó una vez, sus guardados siguientes no necesitan un
 * `horaLeida` más nuevo — el candado solo mira si el aparato es DISTINTO.
 * Lo que sí puede hacer falta es fijarla de nuevo si, a mitad de sesión,
 * otro aparato pisa y ella elige abrir SU borrador (`fijaHoraLeida`).
 *
 * No es un componente de React a propósito: así se prueba con
 * `vi.useFakeTimers()`, igual que el timeout de `./api.ts`, sin montar
 * nada.
 */
export class Autoguardado {
  private readonly fija: typeof setTimeout
  private readonly limpia: typeof clearTimeout
  private retardo: ReturnType<typeof setTimeout> | undefined
  private piso: ReturnType<typeof setTimeout> | undefined
  private pendiente: Documentos | undefined
  private horaLeida: number | undefined
  private forzarProximo = false
  private guardando = false
  private destruido = false

  constructor(private readonly deps: DependenciasAutoguardado) {
    this.fija = deps.fijaTemporizador ?? setTimeout
    this.limpia = deps.limpiaTemporizador ?? clearTimeout
  }

  /** La `hora` que este aparato leyó (o vio en un conflicto), como token de concurrencia del próximo guardado. */
  fijaHoraLeida(hora: number | undefined): void {
    this.horaLeida = hora
  }

  /** El próximo guardado pisa aunque haya uno más nuevo de otro aparato (ella eligió sobrescribir). */
  fuerzaProximoGuardado(): void {
    this.forzarProximo = true
  }

  /** Un cambio nuevo: se acumula, y arranca (o reinicia) el retardo. */
  anota(documentos: Documentos): void {
    if (this.destruido) return
    this.pendiente = documentos
    if (this.retardo !== undefined) this.limpia(this.retardo)
    this.retardo = this.fija(() => void this.ejecuta(), RETARDO_GUARDADO_MS)
    if (this.piso === undefined) {
      this.piso = this.fija(() => void this.ejecuta(), PISO_GUARDADO_MS)
    }
  }

  /**
   * Guarda YA, sin esperar el retardo — para cuando ella pide un guardado
   * a mano (el botón de «guardar de todos modos» tras un conflicto, o un
   * reintento tras un error): las dos veces, esperar diez segundos más
   * sería ignorar que acaba de pedir justo lo contrario.
   */
  guardaAhora(documentos: Documentos): void {
    if (this.destruido) return
    this.pendiente = documentos
    if (this.retardo !== undefined) { this.limpia(this.retardo); this.retardo = undefined }
    if (this.piso !== undefined) { this.limpia(this.piso); this.piso = undefined }
    void this.ejecuta()
  }

  private async ejecuta(): Promise<void> {
    // [H3, ronda de arreglo] Los dos temporizadores que pudieron haber
    // disparado ESTA llamada (el retardo o el piso — `ejecuta()` es el
    // callback de los dos) ya se consumieron: dispararon una vez y no
    // vuelven a hacerlo solos. Por eso se limpian ACÁ ARRIBA, ANTES de
    // cualquier `return` temprano — no adentro del `if` de más abajo, que
    // solo corre cuando el guardado sigue de pie.
    //
    // Antes, la limpieza vivía DESPUÉS de la guarda de `guardando`: un
    // guardado en vuelo (`borrador.guardar` tiene hasta
    // `TIMEOUT_ESCRITURA_MS` = 45 s, más que el piso de 30 s — no es un
    // caso raro, es el caso para el que existe el piso) hacía que la
    // guarda cortara ACÁ, salteándose la limpieza. `this.piso` se quedaba
    // con el id de un temporizador YA disparado (no `undefined`), y como
    // `anota()` solo rearma el piso `if (this.piso === undefined)`, el
    // piso quedaba MUERTO para el resto de la sesión — medido: veinte
    // minutos escribiendo sin pausas, CERO guardados. `test/panel-borrador.test.ts`,
    // «el piso sobrevive a un guardado más largo que él mismo», reproduce
    // exactamente este escenario con relojes inyectados.
    if (this.retardo !== undefined) { this.limpia(this.retardo); this.retardo = undefined }
    if (this.piso !== undefined) { this.limpia(this.piso); this.piso = undefined }

    if (this.destruido || this.pendiente === undefined || this.guardando) return
    const documentos = this.pendiente
    this.pendiente = undefined

    this.guardando = true
    const pisar = this.forzarProximo
    this.forzarProximo = false
    const r = await this.deps.guardar(documentos, { horaLeida: this.horaLeida, pisar })
    this.guardando = false
    if (this.destruido) return

    this.deps.onResultado(trasGuardar(r))

    // Algo nuevo llegó mientras este guardado estaba en vuelo: se vuelve a
    // programar, en vez de perderlo.
    if (this.pendiente !== undefined) this.anota(this.pendiente)
  }

  /**
   * [H4, ronda de arreglo] Lo que se mandaría si se guardara AHORA MISMO,
   * o `null` si no hay nada pendiente — lectura pura, no dispara ningún
   * guardado. Existe para el guardado de emergencia al cerrar la pestaña
   * (`pagehide` en `Sesion.tsx`, con `cuerpoParaBeacon()` más abajo):
   * `destruye()` (el cleanup normal de React) descarta `this.pendiente`
   * en silencio a propósito —es lo correcto cuando el componente se
   * desmonta porque ella navegó DENTRO del panel—, pero cerrar la
   * pestaña entera es un caso distinto, donde perder hasta 30 s de
   * trabajo (el piso) sin avisar no es aceptable.
   */
  datosPendientes(): { documentos: Documentos; horaLeida: number | undefined; pisar: boolean } | null {
    if (this.pendiente === undefined) return null
    return { documentos: this.pendiente, horaLeida: this.horaLeida, pisar: this.forzarProximo }
  }

  destruye(): void {
    this.destruido = true
    if (this.retardo !== undefined) this.limpia(this.retardo)
    if (this.piso !== undefined) this.limpia(this.piso)
  }
}

/**
 * [H4, ronda de arreglo] El cuerpo exacto para el guardado de emergencia
 * al cerrar la pestaña — `null` si no hay nada que mandar: ni con
 * `pendiente: null` (nada sin guardar) ni con `base: null` (el caso raro
 * de `historial()` sin poder leer nada; sin `base` el servidor rechaza
 * con 400 de todos modos, mismo criterio que el resto del autoguardado).
 * Función pura y separada de `Sesion.tsx` para poder probarla sin
 * `navigator.sendBeacon` ni ningún DOM.
 */
export function cuerpoParaBeacon(
  pendiente: { documentos: Documentos; horaLeida: number | undefined; pisar: boolean } | null,
  base: string | null,
): { documentos: Documentos; base: string; horaLeida?: number; pisar: boolean } | null {
  if (pendiente === null || base === null) return null
  return {
    documentos: pendiente.documentos,
    base,
    ...(pendiente.horaLeida !== undefined ? { horaLeida: pendiente.horaLeida } : {}),
    pisar: pendiente.pisar,
  }
}
