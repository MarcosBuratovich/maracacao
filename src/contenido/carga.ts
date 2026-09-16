/*
 * El cargador de contenido.
 *
 * `recorre()` es lo ÚNICO del sistema que toca interna de Zod. Está
 * acotado a propósito a ~60 líneas y a seis formas, y `test/contenido.test.ts`
 * afirma cada una: si una versión nueva de Zod las mueve, falla ahí —con
 * un mensaje que lo explica— y no adentro del panel seis meses después.
 */
import { z } from 'zod'
import { panel, type MetaCampo } from './campos'

type Def = { type: string; [clave: string]: unknown }
const definicion = (e: unknown) => (e as { _zod: { def: Def } })._zod.def

const esContenedor = (tipo: string): boolean =>
  tipo === 'object' || tipo === 'tuple' || tipo === 'array' || tipo === 'union'

const esEnvoltura = (tipo: string): boolean => tipo === 'optional' || tipo === 'nullable'

/**
 * Une un prefijo con una parte de la ruta. La raíz no tiene prefijo, así
 * que su primera parte va SOLA: sin esto, un problema en el elemento 0 de
 * una tupla o de una lista de raíz se reporta como «.0», con un punto
 * colgando adelante — y eso es lo que se lee en un log de Vercel a las
 * once de la noche. Vive acá, en un solo lugar, porque `recorre()` y
 * `ordenaSegun()` arman la MISMA ruta: cuando cada una la armaba por su
 * cuenta, `ordenaSegun()` se acordó de la raíz en UNA de sus tres ramas
 * (el objeto) y se olvidó en las otras dos (tupla y lista).
 */
const con = (prefijo: string, parte: string | number): string =>
  prefijo ? `${prefijo}.${parte}` : String(parte)

/**
 * El único «esto todavía no lo sé hacer» del archivo.
 *
 * `recorre()` y `ordenaSegun()` caminan el MISMO árbol, así que tienen que
 * dar la MISMA respuesta a la misma pregunta. Cuando no la daban
 * —`recorre()` tiraba con una unión y `ordenaSegun()` la devolvía cruda,
 * dejando pasar claves que el esquema no declara— la que callaba era justo
 * la que la Parte B iba a pisar: los bloques de ficha SON una unión
 * discriminada. Un solo constructor del mensaje hace que agregar un caso
 * ruidoso de un lado y olvidarlo del otro se note al escribirlo.
 */
const todaviaNo = (quien: string, que: string, donde: string, cola: string): never => {
  throw new Error(`${quien}(): todavía no sé recorrer ${que} (en «${donde || '(raíz)'}»). ${cola}`)
}

/**
 * Las envolturas que este archivo SÍ sabe pelar son `optional` y
 * `nullable`, y tienen caso propio en los dos switches. Zod trae varias
 * más —`default`, `catch`, `readonly`, `nonoptional`, `prefault`— y las
 * cinco guardan lo que envuelven en `innerType` (verificado contra zod
 * 4.4.3), así que un solo predicado cierra la familia presente y la
 * futura.
 *
 * Sin este chequeo caen en el `default:` del switch, y el riesgo va en las
 * DOS direcciones: `grupo(...).default({...})` se emite como hoja opaca y
 * deja pasar claves que el esquema no declara; `texto(...).default('hola')`
 * hace exactamente lo contrario, porque Zod acepta la clave ausente pero
 * `ordenaSegun()` la reclama igual —un «falta «x»» que durante la
 * migración se lee como un bug de la migración y se paga en horas de
 * depuración.
 *
 * Esto NO las soporta: las hace RUIDOSAS. Cuando la Parte B necesite una,
 * decide cómo pelarla con el caso real delante.
 */
const exigeEnvolturaConocida = (quien: string, def: Def, donde: string): void => {
  if ('innerType' in def) {
    todaviaNo(
      quien,
      `la envoltura «${def.type}»`,
      donde,
      'La Parte B decide cómo atravesarla, con el caso real delante.',
    )
  }
}

/**
 * Pela TODAS las envolturas (`optional`/`nullable`) de una vez y devuelve
 * las TRES cosas que cuelgan de ese mismo desenvolvimiento:
 *
 * - `fondo`: qué hay abajo del todo, que es lo que decide si la envoltura
 *   es transparente (contenedor: hay que atravesar para sacar a los hijos)
 *   o si la envoltura entera es la hoja.
 * - `meta`: el metadato del panel del primer nivel de la cadena que lo tenga.
 * - `opcional`: si en CUALQUIER nivel de la cadena hubo un `.optional()`.
 *   Es lo que decide si `serializa()` puede omitir la clave sin tirar: un
 *   `.optional()` en cualquier posición hace que el valor completo acepte
 *   `undefined` de verdad —Zod lo prueba contra el resto de la cadena—,
 *   así que mirar solo el nivel MÁS EXTERNO se equivoca con
 *   `.optional().nullable()`: ahí el nivel externo es `nullable`, el
 *   `.optional()` quedó adentro, y una clave que sí acepta `undefined`
 *   se exigiría como si fuera obligatoria.
 *
 * Las tres salen de ACÁ, del mismo desenvolvimiento, a propósito — es la
 * lección de este archivo repetida una vez más. Cuando `fondo` y `meta`
 * pelaban por su cuenta cada uno (`fondo` todos los niveles, `meta` uno
 * solo) coincidían con UNA envoltura y se separaban con dos: el nivel
 * intermedio no tiene registro propio, así que el metadato se perdía SIN
 * UN SOLO ERROR y el panel dibujaría ese campo sin nombre. `opcional` es
 * la misma trampa con una tercera pregunta: antes de esto vivía en un
 * desenvolvimiento APARTE, adentro de `ordenaSegun()`, que pelaba un solo
 * nivel — y ese desenvolvimiento aparte fue justo lo que se desincronizó
 * en la revisión de esta tarea. Un desenvolvimiento único no se puede
 * desincronizar de sí mismo.
 *
 * Se pregunta nivel por nivel, de AFUERA hacia adentro, por dos razones:
 * `panel.get()` no sigue la cadena de padres a través de
 * `optional`/`nullable` (crean un tipo nuevo, sin `parent`) aunque sí la
 * siga a través de `.refine()`/`.max()`; y `anota()` recibe siempre el
 * esquema TERMINADO (ver `campos.ts`), así que si la cadena entera está
 * anotada —`precioONada`— esa es la anotación deliberada y gana. Si no lo
 * está —`texto({...}).optional()`, donde la base venía anotada antes de
 * envolverla— se sigue bajando hasta encontrarla.
 *
 * Recursivo y no iterativo a propósito: una cadena circular solo se puede
 * fabricar mutando `_zod.def` a mano, fuera de la API pública, y así
 * revienta enseguida con un `RangeError` en vez de colgarse para siempre.
 */
const desenvuelve = (
  esquema: z.ZodType,
  heredado?: MetaCampo,
  opcional = false,
): { fondo: z.ZodType; meta: MetaCampo | undefined; opcional: boolean } => {
  const meta = heredado ?? (panel.get(esquema) as MetaCampo | undefined)
  const def = definicion(esquema)
  return esEnvoltura(def.type)
    ? desenvuelve(def.innerType as z.ZodType, meta, opcional || def.type === 'optional')
    : { fondo: esquema, meta, opcional }
}

/**
 * El valor literal del discriminante de una variante: 'parrafo' para el
 * bloque de párrafo de una ficha.
 *
 * Toca interna de Zod —`literal` guarda su valor en `def.values`, que es
 * un ARRAY aunque el literal sea uno solo— así que el canario de
 * `test/contenido.test.ts` lo afirma junto con las otras seis formas: si
 * una versión de Zod lo mueve, falla ahí y no adentro del panel.
 */
const varianteDe = (opcion: z.ZodType, discriminante: string, donde: string): string => {
  const shape = definicion(opcion).shape as Record<string, z.ZodType> | undefined
  const campo = shape?.[discriminante]
  const valores = campo && (definicion(campo).values as unknown[] | undefined)
  if (!Array.isArray(valores) || valores.length !== 1 || typeof valores[0] !== 'string') {
    throw new Error(
      `La variante de «${donde || '(raíz)'}» no declara «${discriminante}» como un valor fijo de texto.`,
    )
  }
  return valores[0]
}

/**
 * La marca de variante que va en la ruta: `<tipo=parrafo>`. Lleva la CLAVE
 * además del valor para que la ruta se pueda instanciar contra el dato sin
 * volver a mirar el esquema — es lo que hace `enRutas()` en validacion.ts
 * y lo que va a hacer el panel cuando pinte un bloque.
 */
const marcaDeVariante = (discriminante: string, valor: string): string =>
  `<${discriminante}=${valor}>`

/**
 * El discriminante de una unión, o el mensaje de por qué no se puede
 * recorrer. Las uniones del sistema son TODAS discriminadas; una unión a
 * secas no dice cuál de sus ramas mirar y no se puede ni recorrer ni
 * ordenar sin adivinar.
 */
const discriminanteDe = (quien: string, def: Def, donde: string): string => {
  const d = def.discriminator
  if (typeof d !== 'string') {
    todaviaNo(quien, 'una unión sin discriminante', donde,
      'Las uniones del sistema son discriminadas: la de bloques de ficha, por «tipo».')
  }
  return d as string
}

/**
 * Recorre el árbol del esquema y llama a `visita` en cada HOJA, con su
 * ruta punteada ('hero.titular.1'), el metadato del panel y el esquema
 * que de verdad hay que usar para validar ese valor.
 *
 * Los contenedores (object, array, tuple) no son hojas: se atraviesan.
 * `optional`/`nullable` son transparentes SOLO cuando envuelven un
 * contenedor (ahí hay que seguir para sacar a los hijos). Cuando envuelven
 * una hoja, la hoja que se emite es la envoltura COMPLETA, no el interior
 * desnudo: `precioONada` existe para aceptar `null`, y el `z.int()` de
 * adentro, sin el `.nullable()` puesto, lo rechazaría.
 */
export function recorre(
  esquema: z.ZodType,
  visita: (ruta: string, meta: MetaCampo | undefined, hoja: z.ZodType) => void,
  prefijo = '',
): void {
  const def = definicion(esquema)

  switch (def.type) {
    case 'optional':
    case 'nullable': {
      // Un solo desenvolvimiento alimenta las tres decisiones de este caso.
      const { fondo, meta } = desenvuelve(esquema)
      const dentro = definicion(fondo)
      // Una envoltura desconocida ABAJO de un optional/nullable no llega
      // nunca al `default:` de este switch —este caso emite la hoja y
      // vuelve—, así que el chequeo va también acá.
      exigeEnvolturaConocida('recorre', dentro, prefijo)
      if (esContenedor(dentro.type)) {
        recorre(fondo, visita, prefijo)
      } else {
        visita(prefijo, meta, esquema)
      }
      return
    }
    case 'object': {
      const shape = def.shape as Record<string, z.ZodType>
      for (const clave of Object.keys(shape)) recorre(shape[clave], visita, con(prefijo, clave))
      return
    }
    case 'tuple': {
      const items = def.items as z.ZodType[]
      items.forEach((item, i) => recorre(item, visita, con(prefijo, i)))
      return
    }
    case 'array':
      // La ruta del elemento lleva `[]`: el panel la instancia por índice
      // cuando pinta la lista, y el dato real dice cuántos hay.
      recorre(def.element as z.ZodType, visita, `${prefijo}[]`)
      return
    case 'union': {
      // `z.discriminatedUnion` reporta `def.type === 'union'`, así que sin
      // este caso caería en `default` y se emitiría como HOJA: todos los
      // campos de todas las variantes quedarían invisibles para el panel,
      // sin un solo error.
      const discriminante = discriminanteDe('recorre', def, prefijo)
      for (const opcion of def.options as z.ZodType[]) {
        const variante = marcaDeVariante(discriminante, varianteDe(opcion, discriminante, prefijo))
        recorre(opcion, visita, `${prefijo}${variante}`)
      }
      return
    }
    default:
      exigeEnvolturaConocida('recorre', def, prefijo)
      visita(prefijo, panel.get(esquema), esquema)
  }
}

/** Congela hacia adentro. La garantía real es de runtime, no de tipos. */
function congela<T>(valor: T): T {
  if (valor === null || typeof valor !== 'object') return valor
  for (const v of Object.values(valor)) congela(v)
  return Object.freeze(valor)
}

/**
 * Valida el JSON contra su esquema y devuelve el objeto congelado.
 *
 * Si falla, TIRA. Y tiene que tirar: `cargar()` corre adentro del módulo
 * que `index.astro` importa, así que un JSON inválido revienta
 * `astro build` y Vercel deja servido el deploy anterior. Envolverlo en
 * try/catch publicaría la página rota, que es exactamente lo contrario.
 */
export function cargar<E extends z.ZodType>(
  archivo: string,
  esquema: E,
  crudo: unknown,
): Readonly<z.infer<E>> {
  const r = esquema.safeParse(crudo)
  if (!r.success) {
    const problemas = r.error.issues
      .map((i) => `  ${i.path.join('.') || '(raíz)'}: ${i.message}`)
      .join('\n')
    throw new Error(`${archivo} — ${r.error.issues.length} problema(s):\n${problemas}`)
  }
  return congela(r.data) as Readonly<z.infer<E>>
}

/**
 * Los invisibles salen escapados: el espacio duro, los espacios finos, los
 * de ancho cero y el BOM. Es la convención que el repo ya tiene —hoy hay
 * CERO caracteres U+00A0 literales en el fuente— y existe porque un
 * copiar-y-pegar se los come sin dejar rastro. En la Parte A esto mordió a
 * cuatro implementadores, en las dos direcciones.
 *
 * Exportada porque `serializa()` no es su único usuario: el script de
 * migración escribe el fixture con la misma regla, y dos copias de esta
 * regla es exactamente la clase de bug que esta capa existe para no tener.
 */
export const escapaInvisibles = (json: string): string =>
  json.replace(
    // Escritos como \u para que este archivo no dependa de caracteres que
    // un copiar-y-pegar puede comerse.
    /[\u00a0\u2000-\u200d\ufeff]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )

/**
 * Bytes canónicos: el orden de las claves lo manda el ESQUEMA, no el
 * objeto, y los invisibles (U+00A0 y compañía) salen escapados.
 *
 * Lo primero evita que dos guardados seguidos produzcan diffs distintos
 * sin que haya cambiado nada. Lo segundo conserva una convención que el
 * repo ya tiene: hoy hay cero caracteres U+00A0 literales en el fuente.
 *
 * Tira si el esquema y el dato no coinciden — y por eso además sirve como
 * prueba de que el esquema describe exactamente el contenido de hoy.
 *
 * [I-2] Termina con `\n`. Todo archivo bajo `src/contenido/datos/` termina
 * con un salto de línea final —lo pone Prettier/el editor, la convención
 * de POSIX de «un archivo de texto termina en \n»— así que ANTES de este
 * fix, `serializa()` nunca podía dar bytes idénticos a un archivo real:
 * comparado contra `sitio.json`, `sabores.json` o `fichas.json`, siempre
 * difería en el último byte. La comparación de `publicarAccion()`
 * (`bytesNuevos === vivoTexto`, en `acciones.ts`) que decide «no había
 * nada que publicar» nunca daba verdadero en la primera publicación de un
 * documento —aunque la clienta no hubiera tocado nada— y esa primera
 * publicación le sacaba el `\n` final al archivo. La suite no lo veía
 * porque sus propios fixtures de «lo vivo» se arman con `serializa()`, así
 * que los dos lados de la comparación tenían el mismo bug y coincidían por
 * la razón equivocada.
 */
export function serializa<E extends z.ZodType>(esquema: E, valor: unknown): string {
  return `${escapaInvisibles(JSON.stringify(ordenaSegun(esquema, valor, ''), null, 2))}\n`
}

/**
 * Un bloque es un objeto llano: ni `null`, ni una lista, ni un valor
 * suelto. Los casos 'object' y 'union' de `ordenaSegun()` hacían la MISMA
 * pregunta cada uno por su cuenta —¿esto es un bloque?—, con el mismo
 * chequeo copiado carácter por carácter: la clase de bug que este archivo
 * ya pagó cuatro veces en la Parte A. `typeof valor` no entra en el
 * mensaje: en runtime escupe «string», «number», «undefined» — jerga en
 * inglés que la restricción de vocabulario prohíbe — así que acá se
 * describe la forma en español, no el tipo de JS.
 */
const exigeObjeto = (donde: string, valor: unknown): void => {
  if (valor !== null && typeof valor === 'object' && !Array.isArray(valor)) return
  const forma = valor === null ? 'nada' : Array.isArray(valor) ? 'una lista' : 'un valor suelto, no un bloque'
  throw new Error(`${donde}: el esquema espera un bloque y el dato trae ${forma}.`)
}

function ordenaSegun(esquema: z.ZodType, valor: unknown, ruta: string): unknown {
  const def = definicion(esquema)
  const donde = ruta || '(raíz)'

  switch (def.type) {
    case 'optional':
    case 'nullable': {
      // Misma pregunta que ya resuelve desenvuelve() para recorre() y
      // para la opcionalidad de acá arriba: qué hay abajo de una
      // envoltura optional/nullable lo decide UN desenvolvimiento, no un
      // caso propio de este switch. Antes, el switch solo conocía
      // 'optional': un grupo(...).nullable() con la clave PRESENTE caía
      // en `default` y se salteaba las DOS cosas que ordenaSegun() existe
      // para hacer —reordenar según el esquema y chequear completitud—
      // en el bloque de adentro. Es un tercer criterio para la misma
      // pregunta que ya resuelven recorre() y la opcionalidad: la misma
      // familia de bug, otra vez.
      const { fondo } = desenvuelve(esquema)
      const dentro = definicion(fondo)
      // Igual que en recorre(): una envoltura desconocida abajo de un
      // optional/nullable no llega al `default:` de este switch, porque
      // este caso devuelve el valor y vuelve.
      exigeEnvolturaConocida('serializa', dentro, ruta)
      if (!esContenedor(dentro.type)) return valor
      // undefined (optional) y null (nullable) son los dos valores que
      // la envoltura existe para aceptar sobre un contenedor, y ninguno
      // de los dos necesita reordenarse.
      return valor === undefined || valor === null
        ? valor
        : ordenaSegun(fondo, valor, ruta)
    }

    case 'object': {
      const shape = def.shape as Record<string, z.ZodType>
      exigeObjeto(donde, valor)
      const dato = valor as Record<string, unknown>
      const sobrantes = Object.keys(dato).filter((k) => !(k in shape))
      if (sobrantes.length) {
        throw new Error(
          `${donde}: el dato trae claves que el esquema no declara: ${sobrantes.join(', ')}.`,
        )
      }
      const salida: Record<string, unknown> = {}
      for (const clave of Object.keys(shape)) {
        const hijo = shape[clave]
        // Mismo desenvolvimiento que usa recorre(): pela TODOS los
        // niveles, no uno solo. Un chequeo aparte de un nivel es
        // exactamente el bug que ya pagó recorre() en otra forma — ver
        // el comentario de desenvuelve().
        const { fondo, opcional, meta } = desenvuelve(hijo)
        // Un derivado no se escribe: se calcula (ver derivados.ts). Vive en
        // el esquema para que el panel lo dibuje en gris con su
        // explicación, y en el objeto que cargar() valida, pero no en el
        // archivo — si estuviera, se podría editar a mano y el sitio
        // publicaría un precio que no coincide con ningún producto.
        if (meta?.control === 'derivado') continue
        // Antes de decidir si la clave puede faltar: si el esquema la
        // envuelve en algo que este archivo no sabe pelar, la respuesta
        // honesta es «no sé», no «falta». `texto(...).default('hola')` con
        // `{}` es válido para Zod —para eso está el default— y acá salía
        // un «falta «x»» que en la migración se lee como un bug DE LA
        // MIGRACIÓN y se paga en horas de depuración.
        exigeEnvolturaConocida('serializa', definicion(fondo), con(ruta, clave))
        if (!(clave in dato)) {
          if (opcional) continue
          throw new Error(`${donde}: falta «${clave}», que el esquema declara.`)
        }
        salida[clave] = ordenaSegun(hijo, dato[clave], con(ruta, clave))
      }
      return salida
    }

    case 'tuple': {
      const items = def.items as z.ZodType[]
      if (!Array.isArray(valor) || valor.length !== items.length) {
        throw new Error(`${donde}: el esquema espera exactamente ${items.length} elementos.`)
      }
      return items.map((it, i) => ordenaSegun(it, valor[i], con(ruta, i)))
    }

    case 'array': {
      if (!Array.isArray(valor)) throw new Error(`${donde}: el esquema espera una lista.`)
      return valor.map((v, i) => ordenaSegun(def.element as z.ZodType, v, con(ruta, i)))
    }

    case 'union': {
      // La MISMA respuesta que recorre(), a propósito: las dos caminan el
      // mismo árbol y tienen que contestar lo mismo. Cuando no lo hacían
      // —recorre() tiraba y ordenaSegun() devolvía la unión cruda, dejando
      // pasar claves que el esquema no declara— la que callaba era justo
      // la que esta parte iba a pisar.
      const discriminante = discriminanteDe('serializa', def, ruta)
      exigeObjeto(donde, valor)
      const opciones = def.options as z.ZodType[]
      const nombres = opciones.map((o) => varianteDe(o, discriminante, ruta))
      const dice = (valor as Record<string, unknown>)[discriminante]
      const i = nombres.indexOf(dice as string)
      if (i === -1) {
        throw new Error(
          `${donde}: «${discriminante}» dice «${String(dice)}», que no es ninguna de las variantes declaradas (${nombres.join(', ')}).`,
        )
      }
      return ordenaSegun(opciones[i], valor, ruta)
    }

    default:
      exigeEnvolturaConocida('serializa', def, ruta)
      return valor
  }
}
