/*
 * La puerta del panel. No hay base de datos: la cookie ES la sesión, firmada
 * con HMAC, y la contraseña vive hasheada en una variable de entorno.
 *
 * Ningún secreto real aparece acá: cada test genera el suyo.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import {
  hashDeClave, claveCorrecta, firmaSesion, verificaSesion, cookieDeSesion, intentoPermitido,
  LARGO_MIN_SECRETO,
} from '../src/servidor/sesion'

const SECRETO = 'secreto-de-prueba-no-es-el-de-produccion'

describe('la contraseña', () => {
  it('acepta la correcta y rechaza la equivocada', () => {
    const guardado = hashDeClave('caballo correcto batería grapa')
    expect(claveCorrecta('caballo correcto batería grapa', guardado)).toBe(true)
    expect(claveCorrecta('caballo correcto batería grapo', guardado)).toBe(false)
  })

  it('dos hashes de la misma contraseña son distintos: la sal no se repite', () => {
    expect(hashDeClave('la misma')).not.toBe(hashDeClave('la misma'))
  })

  it('no explota con un hash guardado con otra forma: devuelve false', () => {
    // El modo de falla: alguien pega en la variable un valor de otro formato y
    // la función tira una excepción en vez de decir «contraseña incorrecta».
    expect(claveCorrecta('lo que sea', 'basura')).toBe(false)
    expect(claveCorrecta('lo que sea', '')).toBe(false)
    expect(claveCorrecta('lo que sea', 'scrypt$x$y$z$no$base64')).toBe(false)
  })
})

describe('la cookie de sesión', () => {
  const sesion = { correo: 'clienta@ejemplo.mx', vence: Date.now() + 86_400_000, dispositivo: 'celu' }

  it('vuelve a leer lo que firmó', () => {
    expect(verificaSesion(firmaSesion(sesion, SECRETO), SECRETO)).toEqual(sesion)
  })

  it('rechaza una firma hecha con otro secreto', () => {
    const OTRO_SECRETO = 'otro-secreto-de-prueba-de-32-caracteres-o-mas'
    expect(verificaSesion(firmaSesion(sesion, OTRO_SECRETO), SECRETO)).toBeNull()
  })

  it('rechaza un cuerpo manipulado aunque la firma venga del original', () => {
    // El ataque directo: cambiar el correo de la cookie por otro de la lista.
    const firmada = firmaSesion(sesion, SECRETO)
    const [cuerpo, firma] = firmada.split('.')
    const otro = Buffer.from(JSON.stringify({ ...sesion, correo: 'otra@ejemplo.mx' }))
      .toString('base64url')
    expect(verificaSesion(`${otro}.${firma}`, SECRETO)).toBeNull()
    expect(cuerpo).not.toBe(otro)
  })

  it('rechaza un cuerpo manipulado cuyo vencimiento fabricado ya venció, con la firma del original', () => {
    // La E3 dice: el vencimiento se chequea DESPUÉS de la firma, porque si
    // no, un cuerpo falso decide cuándo vence. Este caso ejercita esa
    // frase al pie de la letra: la firma pegada es la del original (no
    // vencido), pero el cuerpo que la acompaña es enteramente inventado
    // —correo ajeno Y vencimiento ya pasado—. Si algún día el código
    // chequeara el vencimiento ANTES de la firma, y ese chequeo temprano
    // devolviera null «porque venció» sin llegar nunca a validar la
    // firma, este test seguiría en verde por la razón EQUIVOCADA: no
    // porque la firma no coincide (que es el motivo real de rechazo) sino
    // porque el cuerpo dice que ya venció. La sesión legítima del bloque
    // de arriba SIGUE viva (no vencida) cuando se firma acá: por eso la
    // firma que se reutiliza es válida para OTRO cuerpo, no para este.
    const firmada = firmaSesion(sesion, SECRETO)
    const [, firma] = firmada.split('.')
    const fabricado = Buffer.from(
      JSON.stringify({ ...sesion, correo: 'otra@ejemplo.mx', vence: Date.now() - 1 }),
    ).toString('base64url')
    expect(verificaSesion(`${fabricado}.${firma}`, SECRETO)).toBeNull()
  })

  it('rechaza una sesión vencida', () => {
    const vieja = { ...sesion, vence: Date.now() - 1 }
    expect(verificaSesion(firmaSesion(vieja, SECRETO), SECRETO)).toBeNull()
  })

  it('rechaza basura sin tirar', () => {
    for (const mala of ['', 'sinpunto', 'a.b.c', '.', 'x.']) {
      expect(verificaSesion(mala, SECRETO)).toBeNull()
    }
  })

  it('la cookie sale con las banderas que la protegen', () => {
    const c = cookieDeSesion('loquesea', 365)
    expect(c).toContain('HttpOnly')
    expect(c).toContain('Secure')
    expect(c).toContain('SameSite=Lax')
    expect(c).toContain('Path=/')
    expect(c).toMatch(/Max-Age=\d+/)
  })
})

describe('C-1: un PANEL_SECRETO corto o ausente no puede tratarse como el secreto real', () => {
  const sesion = { correo: 'clienta@ejemplo.mx', vence: Date.now() + 86_400_000, dispositivo: 'celu' }

  it('firmaSesion() tira con la cadena vacía y con cualquier secreto corto', () => {
    // La cadena vacía es justo lo que `contexto.env.PANEL_SECRETO ?? ''`
    // producía cuando la variable faltaba en producción: `createHmac`
    // firma con ella sin quejarse, así que el candado tiene que estar acá,
    // no adentro de `createHmac`.
    expect(() => firmaSesion(sesion, '')).toThrow(new RegExp(String(LARGO_MIN_SECRETO)))
    expect(() => firmaSesion(sesion, 'x'.repeat(LARGO_MIN_SECRETO - 1))).toThrow()
  })

  it('firmaSesion() no tira con un secreto de 32 caracteres o más', () => {
    expect(() => firmaSesion(sesion, 'x'.repeat(LARGO_MIN_SECRETO))).not.toThrow()
  })

  it('verificaSesion() devuelve null con un secreto corto, aunque la firma sea la que ESE secreto produciría', () => {
    for (const secretoCorto of ['', 'x'.repeat(LARGO_MIN_SECRETO - 1)]) {
      // Firmada A MANO —firmaSesion() ya no lo permite, es justo lo que
      // arregla este candado— con exactamente el mismo HMAC que produciría
      // un servidor mal configurado que llegara a firmar con esta clave.
      const cuerpo = Buffer.from(JSON.stringify(sesion)).toString('base64url')
      const firma = createHmac('sha256', secretoCorto).update(cuerpo).digest('base64url')
      expect(verificaSesion(`${cuerpo}.${firma}`, secretoCorto)).toBeNull()
    }
  })

  it('el ataque que motiva el candado: una cookie forjada con la clave vacía —que cualquiera puede reproducir sin saber ningún secreto— no pasa cuando PANEL_SECRETO falta', () => {
    // Esto es literalmente lo que un atacante haría si `PANEL_SECRETO`
    // faltara y `acciones.ts` siguiera firmando con `?? ''`: fabricar su
    // propia cookie, firmada con la MISMA clave vacía que usaría el
    // servidor, sin conocer ningún secreto real.
    const sesionDelAtacante = { correo: 'atacante@ajeno.mx', vence: Date.now() + 365 * 86_400_000, dispositivo: 'lo que sea' }
    const cuerpo = Buffer.from(JSON.stringify(sesionDelAtacante)).toString('base64url')
    const firmaForjada = createHmac('sha256', '').update(cuerpo).digest('base64url')
    const cookieForjada = `${cuerpo}.${firmaForjada}`

    // Antes de C-1, un servidor con PANEL_SECRETO ausente verificaba esto
    // contra '' y la aceptaba: la puerta se abría sin que el atacante
    // supiera nada. Ahora, con el secreto vacío pasado explícitamente
    // (el estado exacto de «la variable falta»), rechaza.
    expect(verificaSesion(cookieForjada, '')).toBeNull()
  })
})

describe('el freno a la fuerza bruta', () => {
  it('deja pasar cinco intentos y frena el sexto', () => {
    const ip = `prueba-${Math.random()}`
    for (let i = 0; i < 5; i++) expect(intentoPermitido(ip)).toBe(true)
    expect(intentoPermitido(ip)).toBe(false)
  })

  it('se olvida después de quince minutos', () => {
    const ip = `prueba-${Math.random()}`
    const t0 = Date.now()
    for (let i = 0; i < 5; i++) intentoPermitido(ip, t0)
    expect(intentoPermitido(ip, t0)).toBe(false)
    expect(intentoPermitido(ip, t0 + 15 * 60_000 + 1)).toBe(true)
  })

  it('cuenta por IP, no en total', () => {
    const a = `a-${Math.random()}`, b = `b-${Math.random()}`
    for (let i = 0; i < 5; i++) intentoPermitido(a)
    expect(intentoPermitido(a)).toBe(false)
    expect(intentoPermitido(b)).toBe(true)
  })
})
