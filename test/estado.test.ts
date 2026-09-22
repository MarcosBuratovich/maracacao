/*
 * «¿Ya está en el sitio?» (spec §4.5). Desde la inversión de precedencia
 * —medida en producción: el despliegue había terminado, el CDN ya servía
 * el sha nuevo, y la plataforma igual contestaba «en curso» 31 sondeos
 * seguidos porque esa lectura, la que puede fallar, no encontraba el
 * despliegue— `version.json` (el CDN) alcanza solo para «listo»: es un
 * hecho observable, no un reporte sobre el hecho. La plataforma sigue
 * haciendo falta para la otra pregunta, la que `version.json` no puede
 * contestar sola: «falló» o «todavía va», cuando el CDN todavía muestra lo
 * viejo en los dos casos.
 *
 * Este módulo no tiene red: recibe las dos respuestas ya leídas y decide.
 * Por eso las combinaciones se prueban acá, en milisegundos.
 */
import { describe, it, expect } from 'vitest'
import { decide, fraseDeFracaso, jergaEn } from '../src/servidor/estado'

const SHA = 'a'.repeat(40)
const base = { despliegue: 'enCurso' as const, url: null, shaServido: null, shaPublicado: SHA, desdeHaceMs: 5_000 }

describe('el veredicto', () => {
  /*
   * [Inversión de precedencia] El CDN sirviendo el sha publicado alcanza
   * para «listo» solo, pase lo que pase con `despliegue`. Cuatro de estas
   * cinco celdas CAMBIARON de resultado con el arreglo:
   *   - `'listo'`: ya daba `'listo'` antes también — el caso fácil, el
   *     único que no cambia, y se deja acá para que la fila quede completa.
   *   - `'enCurso'` y `'desconocido'`: daban `'enCurso'` antes — el
   *     escenario medido en producción, 31 sondeos seguidos mintiendo que
   *     todavía faltaba.
   *   - `'falló'`: daba `'falló'` antes. Es la combinación contradictoria
   *     que discute el comentario de `decide()` — un reporte de fracaso
   *     sobre un sha que el CDN ya está sirviendo—, y acá se deja escrito
   *     que gana el hecho observable, no el reporte.
   *   - `null` (Ronda 2/3): ni siquiera se le pudo preguntar a la
   *     plataforma. Antes eso cortaba con 502 sin mirar el CDN; ahora, si
   *     el CDN confirma, ni falta que hacer la pregunta.
   */
  it.each(['listo', 'enCurso', 'desconocido', 'falló', null] as const)(
    'el CDN sirviendo el sha publicado alcanza para "listo" solo, sin importar qué diga el despliegue (%s)',
    (despliegue) => {
      const v = decide({ ...base, despliegue, url: 'https://x.vercel.app', shaServido: SHA })
      expect(v.estado).toBe('listo')
      expect(v.reintentarEn).toBeNull()
      expect(v.frase).toBe('Tu cambio ya está en el sitio.')
    },
  )

  it('el CDN sigue con lo viejo: un despliegue reportado "listo" todavía NO alcanza', () => {
    // Es la ventana exacta en la que el panel mentía si mirara una sola
    // fuente. Dura segundos, y en esos segundos ella abre el sitio y ve el
    // precio de antes.
    const v = decide({ ...base, despliegue: 'listo', shaServido: 'b'.repeat(40) })
    expect(v.estado).toBe('enCurso')
    expect(v.reintentarEn).toBe(3_000)
  })

  it('falló es definitivo: no se vuelve a preguntar', () => {
    const v = decide({ ...base, despliegue: 'falló', fracaso: { revertido: true, avisadoAMarcos: true } })
    expect(v.estado).toBe('falló')
    expect(v.reintentarEn).toBeNull()
    expect(v.frase).toBe('No salió; lo dejé como estaba y ya le avisé a Marcos.')
  })

  /*
   * [Revisión final de la rama, I4] La frase del fracaso prometía DOS cosas
   * que este módulo no hace —que algo se dejó como estaba, y que se le avisó
   * a Marcos— y las dos pueden ser falsas. El comentario del propio archivo
   * ya lo anticipaba («es una promesa que este archivo hace y otro paga»): el
   * pago está condicionado, así que la promesa también.
   *
   * El escenario medido: las variables de correo todavía no están cargadas
   * (es un trámite de DNS), `mandaProtegido()` degrada por diseño, ella lee
   * que Marcos ya sabe, Marcos no sabe nada, y los dos esperan al otro.
   */
  describe('I4: la frase del fracaso dice lo que de verdad pasó', () => {
    const conFracaso = (revertido: boolean, avisadoAMarcos: boolean) =>
      decide({ ...base, despliegue: 'falló', fracaso: { revertido, avisadoAMarcos } }).frase

    it('sin correo a Marcos, no promete que Marcos sabe', () => {
      const frase = conFracaso(true, false)
      expect(frase).not.toContain('ya le avisé a Marcos')
      expect(frase).toContain('lo dejé como estaba') // esto sí pasó
      expect(frase).toContain('Avísale a Marcos') // y le dice qué hacer
    })

    it('sin reversión, no promete que lo dejó como estaba', () => {
      const frase = conFracaso(false, true)
      expect(frase).toContain('no pude dejarlo como estaba')
      expect(frase).toContain('Ya le avisé a Marcos')
    })

    it('sin nada de las dos, no promete ninguna', () => {
      const frase = conFracaso(false, false)
      expect(frase).toContain('no pude dejarlo como estaba')
      expect(frase).not.toContain('ya le avisé a Marcos')
    })

    it('sin `fracaso` —nadie intentó nada todavía— la frase no promete ninguna de las dos', () => {
      const frase = decide({ ...base, despliegue: 'falló' }).frase
      expect(frase).not.toContain('lo dejé como estaba')
      expect(frase).not.toContain('ya le avisé a Marcos')
    })

    it('las cuatro frases, y la de «nadie intentó», siguen sin jerga técnica', () => {
      const todas = [
        fraseDeFracaso(),
        fraseDeFracaso({ revertido: true, avisadoAMarcos: true }),
        fraseDeFracaso({ revertido: true, avisadoAMarcos: false }),
        fraseDeFracaso({ revertido: false, avisadoAMarcos: true }),
        fraseDeFracaso({ revertido: false, avisadoAMarcos: false }),
      ]
      // Cinco distintas: si dos colapsaran, una de las dos estaría mintiendo.
      expect(new Set(todas).size).toBe(5)
      for (const f of todas) expect(jergaEn(f), f).toBeNull()
    })
  })

  it('la cadencia la dicta el servidor: 3 s el primer minuto, 6 s después', () => {
    expect(decide({ ...base, desdeHaceMs: 0 }).reintentarEn).toBe(3_000)
    expect(decide({ ...base, desdeHaceMs: 59_000 }).reintentarEn).toBe(3_000)
    expect(decide({ ...base, desdeHaceMs: 60_001 }).reintentarEn).toBe(6_000)
    expect(decide({ ...base, desdeHaceMs: 250_000 }).reintentarEn).toBe(6_000)
  })

  it('a los cinco minutos deja de preguntar, y lo dice sin mentir', () => {
    // «NUNCA gira infinito» (spec §4.5). Y el texto no puede prometer un
    // aviso que nadie va a mandar: si ella cerró el panel, no hay quien
    // sondee. Se le dice que vuelva a mirar, que es lo único cierto.
    const v = decide({ ...base, desdeHaceMs: 300_001 })
    expect(v.reintentarEn).toBeNull()
    expect(v.estado).toBe('enCurso')
    expect(v.frase).toBe('Tu cambio está tardando más de lo normal. Vuelve a abrir el panel en un rato para ver cómo quedó.')
  })

  it('«desconocido» no es «falló»: se sigue esperando', () => {
    // La plataforma todavía no vio el commit. Tratarlo como fracaso
    // dispararía una reversión automática por un webhook que tardó.
    const v = decide({ ...base, despliegue: 'desconocido' })
    expect(v.estado).toBe('enCurso')
  })

  /*
   * [Ronda 3] `null` tampoco es «falló» — y tampoco es «desconocido», aunque
   * caigan en el mismo lado de la asimetría. Son dos hechos distintos:
   * `'desconocido'` es un reporte REAL de la plataforma («no tengo ningún
   * despliegue para este commit»); `null` es la AUSENCIA de reporte —no se
   * le pudo preguntar nada—. Mezclarlos fue un bug real de esta misma
   * vuelta de arreglos (Ronda 2 usaba `'desconocido'` para «no contestó»).
   * Este test existe para que si alguien intenta unificarlos de nuevo —dos
   * valores que se comportan igual son un candidato tentador a fusionar—,
   * se acuerde de por qué no: el tipo, no el comportamiento, es lo que los
   * separa, y el tipo es lo que evita que el log de Marcos mienta sobre
   * cuál de las dos cosas pasó.
   */
  it('`despliegue: null` —no se le pudo preguntar nada a la plataforma— tampoco es «falló»', () => {
    const v = decide({ ...base, despliegue: null })
    expect(v.estado).toBe('enCurso')
  })

  it('B10: ninguna de las cuatro frases nombra una tecnología', () => {
    const frases = [
      decide({ ...base, despliegue: 'listo', shaServido: SHA }).frase,
      decide({ ...base }).frase,
      decide({ ...base, despliegue: 'falló' }).frase,
      decide({ ...base, desdeHaceMs: 300_001 }).frase,
    ]
    for (const f of frases) {
      expect(jergaEn(f), f).toBeNull()
    }
  })
})

describe('jergaEn', () => {
  // [Tarea 9, Ronda 1] `'sha'` —la entrada de tres letras de
  // `JERGA_PROHIBIDA`— es también un fragmento de «deshacer» y de
  // «deshabilitar», dos palabras de vocabulario de panel completamente
  // normales. Un chequeo por substring crudo las rechazaría igual que
  // rechaza «el sha del commit» de verdad.
  it('deja pasar el vocabulario del panel que por casualidad contiene «sha»', () => {
    expect(jergaEn('Deshacer esta publicación')).toBeNull()
    expect(jergaEn('Puedo deshabilitar esa opción si hace falta')).toBeNull()
  })

  it('atrapa «sha» cuando aparece como palabra suelta', () => {
    expect(jergaEn('el sha del commit')).not.toBeNull()
  })

  it('no se le escapa por la mayúscula', () => {
    expect(jergaEn('hubo un problema con el Deploy')).not.toBeNull()
  })

  it('está limpia si ninguna palabra de la lista aparece', () => {
    expect(jergaEn('Listo, lo dejé como estaba antes.')).toBeNull()
  })
})
