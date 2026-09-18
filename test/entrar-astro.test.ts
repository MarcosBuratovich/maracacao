/*
 * `/panel/entrar` (Tarea 12, spec §4.1): el enlace mágico de recuperación.
 * Tres cosas verificables, todas de seguridad — no de diseño:
 *
 * - NO usa el `candado` de `Base.astro` (ese candado es «una tranca, NO
 *   seguridad real»; ver el comentario de cabecera del propio archivo).
 * - Tiene el botón que consume el enlace con POST (nunca GET).
 * - El script llama a `history.replaceState` apenas carga, para sacar el
 *   token de la barra de direcciones.
 */
import { describe, it, expect } from 'vitest'
import { experimental_AstroContainer as AstroContainer } from 'astro/container'
import Entrar from '@/pages/panel/entrar.astro'
import { jergaEn } from '@/servidor/estado'

const container = await AstroContainer.create()

// Los seis textos que ella puede llegar a ver en esta pantalla, sacados a
// mano del script (no hay ningún `data-campo` acá: es una página fuera del
// sistema de copy, igual que el resto de `src/servidor/**`). Un cambio que
// meta jerga técnica en alguno de los seis tiene que hacer caer este test.
const TEXTOS_VISIBLES = [
  'Entrar al panel',
  'Un momento…',
  'Este enlace no funciona. Pide uno nuevo.',
  'Entrando…',
  'Listo, ya entraste.',
  'Ese enlace ya no sirve: pide uno nuevo.',
  'No se pudo conectar. Intenta de nuevo.',
]

describe('la página /panel/entrar', () => {
  it('sin candado: no lleva `data-candado` en ningún lado', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).not.toContain('data-candado')
  })

  it('tiene un botón para entrar', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).toMatch(/<button[^>]*id="entrar"[^>]*>/)
  })

  it('el botón consume el enlace con POST, nunca GET, contra la acción entrar-con-enlace', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).toMatch(/method:\s*['"]POST['"]/)
    expect(html).toContain('accion=entrar-con-enlace')
  })

  it('saca el token de la barra de direcciones apenas carga, con history.replaceState', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).toContain('history.replaceState')
  })

  it('sin React ni islas: ningún script con `client:`', async () => {
    const html = await container.renderToString(Entrar)
    expect(html).not.toMatch(/client:(load|idle|visible|only|media)/)
  })

  it('todos los textos que puede ver están en la página, y ninguno usa jerga técnica', async () => {
    const html = await container.renderToString(Entrar)
    for (const texto of TEXTOS_VISIBLES) {
      expect(html, `no se encontró «${texto}» en la página`).toContain(texto)
      expect(jergaEn(texto), texto).toBeNull()
    }
  })
})
