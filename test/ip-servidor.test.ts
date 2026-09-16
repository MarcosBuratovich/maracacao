/*
 * La IP de quien pide, sacada de cabeceras HTTP (M-2). El test importa el
 * MISMO módulo que importa `src/servidor/entradas/panel.ts` — igual que
 * `test/origen-servidor.test.ts` con `origen.ts` — así que cubre el orden
 * de preferencia sin mockear ningún pedido HTTP de verdad.
 */
import { describe, it, expect } from 'vitest'
import { ipDelPedido } from '../src/servidor/ip'

describe('la IP de quien pide (M-2)', () => {
  it('prefiere x-vercel-forwarded-for, que el cliente no puede pisar', () => {
    const cabeceras = { 'x-vercel-forwarded-for': '9.9.9.9', 'x-forwarded-for': '1.2.3.4' }
    expect(ipDelPedido(cabeceras)).toBe('9.9.9.9')
  })

  it('un x-forwarded-for fabricado por el cliente no gana cuando x-vercel-forwarded-for está presente', () => {
    // El ataque que motiva M-2: un cliente manda su PROPIO
    // x-forwarded-for con una IP inventada al frente, para que «la
    // primera de la lista» sea esa IP inventada y no la suya real —y así
    // el freno de intentos (E4) cuente contra la IP que el atacante elige.
    const cabeceras = { 'x-forwarded-for': 'ip-inventada, 9.9.9.9', 'x-vercel-forwarded-for': '9.9.9.9' }
    expect(ipDelPedido(cabeceras)).toBe('9.9.9.9')
    expect(ipDelPedido(cabeceras)).not.toBe('ip-inventada')
  })

  it('sin x-vercel-forwarded-for, usa x-real-ip', () => {
    expect(ipDelPedido({ 'x-real-ip': '8.8.8.8', 'x-forwarded-for': '1.2.3.4' })).toBe('8.8.8.8')
  })

  it('sin ninguna de las dos cabeceras de Vercel, usa la primera de x-forwarded-for — para correr en local', () => {
    expect(ipDelPedido({ 'x-forwarded-for': '1.2.3.4, 5.6.7.8' })).toBe('1.2.3.4')
  })

  it('sin ninguna cabecera, "desconocida" — nunca explota', () => {
    expect(ipDelPedido({})).toBe('desconocida')
  })

  it('acepta una cabecera repetida (que llega como lista) igual que una cadena', () => {
    expect(ipDelPedido({ 'x-vercel-forwarded-for': ['9.9.9.9', '1.1.1.1'] })).toBe('9.9.9.9')
  })
})
