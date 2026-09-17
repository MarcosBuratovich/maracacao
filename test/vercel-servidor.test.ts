/*
 * El cliente de la API de la plataforma: la mitad de «¿ya está en el sitio?»
 * que sabe si el deploy TERMINÓ (la otra mitad es `version.json`).
 *
 * Como el resto de `src/servidor/**`, es puro e inyectable: el token, el
 * proyecto y el `fetch` llegan por parámetro, así que esto se prueba entero
 * sin red y sin ningún token real.
 */
import { describe, it, expect } from 'vitest'
import { fetchFalso } from './lib/github-falso'
import { clienteVercel } from '../src/servidor/vercel'

const deV = (fetch: typeof globalThis.fetch) => clienteVercel({ token: 't', proyecto: 'maracacao', fetch })

describe('el estado del despliegue de un commit', () => {
  it('READY es «listo», y trae la dirección del despliegue', async () => {
    const { f, pedidos } = fetchFalso([
      { cuerpo: { deployments: [{ state: 'READY', url: 'maracacao-abc.vercel.app' }] } },
    ])
    expect(await deV(f).despliegueDe('a'.repeat(40))).toEqual({ estado: 'listo', url: 'https://maracacao-abc.vercel.app' })
    expect(pedidos[0].cabeceras.Authorization).toBe('Bearer t')
  })

  it('ERROR y CANCELED son «falló»: los dos terminan sin sitio nuevo', async () => {
    for (const state of ['ERROR', 'CANCELED']) {
      const { f } = fetchFalso([{ cuerpo: { deployments: [{ state, url: null }] } }])
      expect((await deV(f).despliegueDe('a'.repeat(40))).estado).toBe('falló')
    }
  })

  it('BUILDING, QUEUED e INITIALIZING son «enCurso»', async () => {
    for (const state of ['BUILDING', 'QUEUED', 'INITIALIZING']) {
      const { f } = fetchFalso([{ cuerpo: { deployments: [{ state, url: null }] } }])
      expect((await deV(f).despliegueDe('a'.repeat(40))).estado).toBe('enCurso')
    }
  })

  it('B9: un estado que no conocemos se lee como «enCurso», nunca como listo ni como falló', async () => {
    // Equivocarse hacia «seguí esperando» cuesta unos segundos de espera.
    // Equivocarse hacia «listo» le miente a la clienta; hacia «falló»
    // dispara una reversión que nadie pidió. La asimetría es el argumento.
    const { f } = fetchFalso([{ cuerpo: { deployments: [{ state: 'ALGO_NUEVO', url: null }] } }])
    expect((await deV(f).despliegueDe('a'.repeat(40))).estado).toBe('enCurso')
  })

  it('sin ningún despliegue para ese commit, «desconocido» — que no es lo mismo que en curso', async () => {
    // Todavía no apareció: puede ser que la plataforma no lo haya visto aún,
    // o que nunca lo vaya a ver. El que decide qué hacer con eso es
    // `estado.ts`, mirando cuánto hace que se publicó — no este módulo.
    const { f } = fetchFalso([{ cuerpo: { deployments: [] } }])
    expect(await deV(f).despliegueDe('a'.repeat(40))).toEqual({ estado: 'desconocido', url: null })
  })

  it('si la plataforma contesta un error, tira — no inventa un estado', async () => {
    const { f } = fetchFalso([{ status: 403, cuerpo: { error: { message: 'Not authorized' } } }])
    await expect(deV(f).despliegueDe('a'.repeat(40))).rejects.toThrow(/403/)
  })
})
