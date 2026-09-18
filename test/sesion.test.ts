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
  clavesDeFreno, LARGO_MIN_SECRETO,
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
  const sesion = { correo: 'clienta@ejemplo.mx', vence: Date.now() + 86_400_000, dispositivo: 'celu', emitida: Date.now() }

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
  const sesion = { correo: 'clienta@ejemplo.mx', vence: Date.now() + 86_400_000, dispositivo: 'celu', emitida: Date.now() }

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

describe('emitida y el propósito adentro de la firma', () => {
  it('la sesión firmada dice cuándo se emitió', () => {
    const secreto = 'x'.repeat(40)
    const cookie = firmaSesion(
      { correo: 'a@b.mx', vence: 2_000_000, dispositivo: 'celu', emitida: 1_000_000 },
      secreto,
    )
    expect(verificaSesion(cookie, secreto, 1_500_000)?.emitida).toBe(1_000_000)
  })

  it('una cookie sin `emitida` no vale, aunque la firma sea buena', () => {
    // No es paranoia: es lo que hace que el candado de `PANEL_SESIONES_DESDE`
    // no se pueda saltear mandando una cookie vieja a la que le falta el campo.
    const secreto = 'x'.repeat(40)
    const cuerpo = Buffer.from(JSON.stringify({ correo: 'a@b.mx', vence: 2_000_000, dispositivo: 'celu' })).toString('base64url')
    const firma = createHmac('sha256', secreto).update(`sesion|${cuerpo}`).digest('base64url')
    expect(verificaSesion(`${cuerpo}.${firma}`, secreto, 1_500_000)).toBeNull()
  })

  it('C-2: la firma lleva el propósito adentro, así que un token de otro propósito no sirve de cookie', () => {
    // Sin esto, cualquier cosa que este mismo secreto firme —el enlace mágico
    // de la Tarea 12— serviría como cookie de sesión y al revés. El propósito
    // va ADENTRO de lo que se firma (spec §4.1), no al lado.
    const secreto = 'x'.repeat(40)
    const cuerpo = Buffer.from(JSON.stringify({ correo: 'a@b.mx', vence: 2_000_000, dispositivo: 'celu', emitida: 1 })).toString('base64url')
    const firmaDeOtroProposito = createHmac('sha256', secreto).update(`entrar|${cuerpo}`).digest('base64url')
    expect(verificaSesion(`${cuerpo}.${firmaDeOtroProposito}`, secreto, 1_500_000)).toBeNull()
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

  it('cuenta por clave, no en total', () => {
    const a = `a-${Math.random()}`, b = `b-${Math.random()}`
    for (let i = 0; i < 5; i++) intentoPermitido(a)
    expect(intentoPermitido(a)).toBe(false)
    expect(intentoPermitido(b)).toBe(true)
  })

  // [Ronda 1, Tarea 12, hallazgo E] La clave ya no es solo la IP: cada
  // llamador arma la suya (`<acción>:<ip>` en acciones.ts) para que el
  // presupuesto de una acción no le coma el de otra — acá, con dos claves
  // que comparten la misma IP pero un prefijo distinto, para probar que
  // la función no le presta ninguna atención a lo que la clave signifique.
  it('[Ronda 1, hallazgo E] dos claves con la misma IP pero prefijo distinto no comparten presupuesto', () => {
    const ip = `${Math.random()}`
    const claveA = `entrar:${ip}`
    const claveB = `enlace:${ip}`
    for (let i = 0; i < 5; i++) expect(intentoPermitido(claveA)).toBe(true)
    expect(intentoPermitido(claveA)).toBe(false)
    expect(intentoPermitido(claveB)).toBe(true) // otro prefijo, mismo "ip": presupuesto propio
  })

  // [Ronda 1, hallazgo F] `tope` es configurable para el freno por
  // destinatario, que protege otra cosa (la bandeja de ella) con otro
  // número (tres, no cinco).
  it('[Ronda 1, hallazgo F] `tope` configurable: dos intentos permitidos, el tercero frena', () => {
    const clave = `tope-chico-${Math.random()}`
    expect(intentoPermitido(clave, Date.now(), 2)).toBe(true)
    expect(intentoPermitido(clave, Date.now(), 2)).toBe(true)
    expect(intentoPermitido(clave, Date.now(), 2)).toBe(false)
  })
})

/*
 * [Revisión final de la rama] El `Map` del freno filtraba las marcas viejas
 * de la clave que se consultaba, pero NUNCA borraba una clave.
 *
 * Cada dirección distinta que alguien mande a `enlace` deja la suya
 * (`enlace-destino:<correo>`, acciones.ts), y eso es entrada controlada por
 * quien ataca: un bucle con direcciones inventadas hacía crecer este `Map`
 * sin techo mientras la instancia viviera. Con el barrido, lo que queda vivo
 * está acotado por las claves vistas EN LA VENTANA, no por todas las vistas
 * desde que arrancó el proceso.
 */
describe('el freno de intentos no acumula claves para siempre', () => {
  it('las claves que nadie volvió a usar en la ventana se sueltan', () => {
    const ahora = 4_000_000_000_000
    const antes = clavesDeFreno()

    // Bien por encima del umbral de barrido (mil): es lo que simula el bucle
    // con direcciones inventadas.
    for (let i = 0; i < 1_500; i++) {
      intentoPermitido(`basura-${ahora}-${i}`, ahora)
    }
    expect(clavesDeFreno()).toBeGreaterThan(antes + 1_000)

    // Pasada la ventana de quince minutos, el primer pedido que llegue barre
    // lo vencido: ninguna de esas mil quinientas claves sigue viva.
    const despues = ahora + 16 * 60_000
    intentoPermitido('alguien-de-verdad', despues)
    expect(clavesDeFreno()).toBeLessThan(100)
  })

  it('barrer no le saca el presupuesto a quien SÍ está dentro de la ventana', () => {
    // Lo que no puede pasar: que la limpieza le regale intentos a quien está
    // siendo frenado ahora mismo. Es el freno de la puerta principal.
    const ahora = 5_000_000_000_000
    const clave = `vigente-${Math.random()}`
    for (let i = 0; i < 5; i++) expect(intentoPermitido(clave, ahora)).toBe(true)
    expect(intentoPermitido(clave, ahora)).toBe(false)

    for (let i = 0; i < 1_500; i++) intentoPermitido(`ruido-${ahora}-${i}`, ahora)
    expect(intentoPermitido(clave, ahora + 1_000)).toBe(false) // sigue frenado
  })
})
