/*
 * «¿Ya está en el sitio?» son DOS preguntas, no una (spec §4.5): la
 * plataforma dice que el deploy TERMINÓ, y `version.json` dice qué commit
 * está sirviendo el CDN. Cantar «listo» con la primera sola es mandarla a
 * mirar un sitio que todavía entrega lo viejo.
 *
 * Este módulo no tiene red: recibe las dos respuestas ya leídas y decide.
 * Por eso las once combinaciones se prueban acá, en milisegundos.
 */
import { describe, it, expect } from 'vitest'
import { decide, jergaEn } from '../src/servidor/estado'

const SHA = 'a'.repeat(40)
const base = { despliegue: 'enCurso' as const, url: null, shaServido: null, shaPublicado: SHA, desdeHaceMs: 5_000 }

describe('el veredicto', () => {
  it('B2: listo exige las DOS fuentes — la plataforma terminó Y el CDN ya sirve ese commit', () => {
    const v = decide({ ...base, despliegue: 'listo', url: 'https://x.vercel.app', shaServido: SHA })
    expect(v.estado).toBe('listo')
    expect(v.reintentarEn).toBeNull()
    expect(v.frase).toBe('Tu cambio ya está en el sitio.')
  })

  it('B2: la plataforma terminó pero el CDN sigue con lo viejo: todavía NO está listo', () => {
    // Es la ventana exacta en la que el panel mentía si mirara una sola
    // fuente. Dura segundos, y en esos segundos ella abre el sitio y ve el
    // precio de antes.
    const v = decide({ ...base, despliegue: 'listo', shaServido: 'b'.repeat(40) })
    expect(v.estado).toBe('enCurso')
    expect(v.reintentarEn).toBe(3_000)
  })

  it('falló es definitivo: no se vuelve a preguntar', () => {
    const v = decide({ ...base, despliegue: 'falló' })
    expect(v.estado).toBe('falló')
    expect(v.reintentarEn).toBeNull()
    expect(v.frase).toBe('No salió; lo dejé como estaba y ya le avisé a Marcos.')
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
