/* Comportamiento del sitio rediseñado (2026-08-13).
 *
 * Todo es mejora progresiva: sin JS la página se ve completa y quieta
 * (los paneles de pestañas se apilan, el menú es una fila de enlaces,
 * el anaquel muestra la canela). Con `prefers-reduced-motion` no se
 * registran cursor, imanes, parallax ni marquesinas — la regla es
 * apagar, no atenuar. */

export {} // módulo: si no, TypeScript trata el archivo como script global

interface DatoSabor {
  slug: string
  orden: number
  nombre: string
  cacao: string
  precio: string
  ingredientes: string
  color: string
  tinta: string
  /** Página del producto en el catálogo (o la categoría de barras). */
  url: string
}

const raiz = document.documentElement
raiz.classList.add('js')

const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
const punteroFino = matchMedia('(pointer: fine)').matches

/* ---------- La barra 3D (compartida) ----------
   El modelo de Marcos (Blender): UN solo GLB para los quince sabores —
   cambiarle la textura del material «Label» por el pliego de imprenta
   del sabor es cambiar de barra. La usan la ficha del anaquel (la home)
   y el catálogo inmersivo (/barras). model-viewer va self-hosteado y
   se carga una sola vez. */

interface VisorModelo extends HTMLElement {
  model?: {
    materials: Array<{
      name: string
      pbrMetallicRoughness: { baseColorTexture: { setTexture(t: unknown): void } }
    }>
  }
  createTexture(uri: string): Promise<unknown>
}

declare global {
  interface Window { __mvCargando?: Promise<void> }
}

function cargarModelViewer(): Promise<void> {
  window.__mvCargando ??= new Promise<void>((listo, falla) => {
    const s = document.createElement('script')
    s.type = 'module'
    s.src = '/vendor/model-viewer.min.js'
    s.onload = () => listo()
    s.onerror = () => falla(new Error('model-viewer no cargó'))
    document.head.appendChild(s)
  })
  return window.__mvCargando
}

/** Monta el visor en `caja` y resuelve con la función que cambia el
 *  pliego. Rechaza si la librería o el modelo no cargan — la imagen
 *  fija queda y la página no se entera. */
async function montarBarra3D(caja: HTMLElement, alt: string): Promise<(slug: string) => void> {
  await cargarModelViewer()
  await customElements.whenDefined('model-viewer')

  const mv = document.createElement('model-viewer') as unknown as VisorModelo
  mv.setAttribute('src', caja.dataset.glb ?? '')
  mv.setAttribute('alt', alt)
  mv.setAttribute('camera-controls', '')
  mv.setAttribute('disable-zoom', '')
  // Sin auto-rotate (retro de Marcos: mareaba y recortaba); la barra
  // arranca de frente y el visitante la gira si quiere — model-viewer
  // muestra su pista de arrastre tras un momento de quietud.
  mv.setAttribute('camera-orbit', '188deg 82deg 105%')
  mv.setAttribute('shadow-intensity', '0.8')
  mv.setAttribute('exposure', '1.1')

  const texturas = new Map<string, unknown>()
  const aplica = async (slug: string) => {
    if (!mv.model) return
    let tex = texturas.get(slug)
    if (!tex) {
      tex = await mv.createTexture(`/sitio/marca/pliego-${slug}.webp`)
      texturas.set(slug, tex)
    }
    const label = mv.model.materials.find((m) => m.name === 'Label')
    label?.pbrMetallicRoughness.baseColorTexture.setTexture(tex)
  }

  const cargado = new Promise<void>((listo, falla) => {
    mv.addEventListener('load', () => listo(), { once: true })
    mv.addEventListener('error', () => falla(new Error('el modelo no cargó')), { once: true })
  })
  caja.appendChild(mv)
  await cargado
  caja.classList.add('con-3d')
  return (slug) => { void aplica(slug) }
}

/* ---------- 1. Menú overlay ---------- */

const menuBoton = document.querySelector<HTMLButtonElement>('[data-menu-boton]')
const menu = document.querySelector<HTMLElement>('[data-menu]')
const menuTexto = document.querySelector<HTMLElement>('[data-menu-texto]')

if (menuBoton && menu) {
  const enlaces = [...menu.querySelectorAll<HTMLAnchorElement>('[data-menu-enlace]')]
  let abierto = false

  const fija = (estado: boolean) => {
    abierto = estado
    menu.classList.toggle('abierto', abierto)
    raiz.classList.toggle('menu-abierto', abierto)
    menuBoton.setAttribute('aria-expanded', String(abierto))
    if (menuTexto) menuTexto.textContent = abierto ? 'Cerrar menú' : 'Abrir menú'
    document.body.style.overflow = abierto ? 'hidden' : ''
    // El overlay no es una sección [data-tono], así que el cursor de
    // sello conservaría la tinta anterior (invisible sobre el fondo
    // oscuro): acá se le da la crema. Al cerrar, el próximo movimiento
    // sobre una sección lo recalcula solo.
    if (abierto) raiz.style.setProperty('--cursor-color', 'var(--mrc-marca-crema)')
    if (abierto) enlaces[0]?.focus()
  }

  menuBoton.addEventListener('click', () => fija(!abierto))
  for (const a of enlaces) a.addEventListener('click', () => fija(false))

  addEventListener('keydown', (e) => {
    if (!abierto) return
    if (e.key === 'Escape') {
      fija(false)
      menuBoton.focus()
      return
    }
    // Trampa de foco: Tab circula entre el botón y los enlaces del menú.
    if (e.key !== 'Tab') return
    const ciclo: HTMLElement[] = [menuBoton, ...enlaces]
    const i = ciclo.indexOf(document.activeElement as HTMLElement)
    if (i === -1) return
    const destino = e.shiftKey
      ? ciclo[(i - 1 + ciclo.length) % ciclo.length]
      : ciclo[(i + 1) % ciclo.length]
    e.preventDefault()
    destino.focus()
  })
}

/* ---------- 2. Pestañas (postura y negocios) ---------- */

for (const grupo of document.querySelectorAll<HTMLElement>('[data-tabs]')) {
  const tabs = [...grupo.querySelectorAll<HTMLButtonElement>('[data-tab]')]
  const paneles = [...grupo.querySelectorAll<HTMLElement>('[data-panel]')]
  if (tabs.length === 0) continue

  const elige = (n: number) => {
    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === n))
      t.tabIndex = i === n ? 0 : -1
    })
    paneles.forEach((p, i) => { p.hidden = i !== n })
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => elige(i))
    tab.addEventListener('keydown', (e) => {
      const paso = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
      if (!paso) return
      e.preventDefault()
      const n = (i + paso + tabs.length) % tabs.length
      elige(n)
      tabs[n].focus()
    })
  })
  elige(tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true') || 0)
}

/* ---------- 3. El anaquel ---------- */

const datosCrudos = document.getElementById('datos-anaquel')?.textContent
const anaquel = document.querySelector<HTMLElement>('[data-anaquel]')

if (datosCrudos && anaquel) {
  const datos: DatoSabor[] = JSON.parse(datosCrudos)
  const porSlug = new Map(datos.map((d) => [d.slug, d]))
  const radios = [...anaquel.querySelectorAll<HTMLButtonElement>('[data-anaquel-radio]')]
  const banda = document.querySelector<HTMLElement>('[data-anaquel-banda]')

  const campo = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)
  const contador = campo('[data-anaquel-contador]')
  const envoltura = campo<HTMLImageElement>('.ficha-envoltura img')
  const ilustracion = campo<HTMLImageElement>('[data-anaquel-ilustracion]')
  // Las quince fichas vienen renderizadas del build (SEO: nombre,
  // precio e ingredientes son texto indexable). Acá solo se decide
  // cuál se ve; sin JS se apilan las quince, completas.
  const fichas = [...document.querySelectorAll<HTMLElement>('[data-ficha-de]')]

  let slugActual =
    radios.find((r) => r.getAttribute('aria-checked') === 'true')?.dataset.anaquelRadio ?? 'canela'
  // El visor 3D se engancha acá cuando termina de cargar (sección 3c).
  let visorElige: ((slug: string) => void) | null = null

  fichas.forEach((f) => { f.hidden = f.dataset.fichaDe !== slugActual })

  const elige = (slug: string, enfoca = false) => {
    const d = porSlug.get(slug)
    if (!d) return
    slugActual = slug
    visorElige?.(slug)
    radios.forEach((r) => {
      const es = r.dataset.anaquelRadio === slug
      r.setAttribute('aria-checked', String(es))
      r.tabIndex = es ? 0 : -1
      if (es && enfoca) r.focus()
      if (es) r.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth', block: 'nearest', inline: 'center' })
    })
    banda?.style.setProperty('--fondo', d.color)
    banda?.style.setProperty('--texto', d.tinta)
    if (contador) contador.textContent = String(d.orden)
    fichas.forEach((f) => { f.hidden = f.dataset.fichaDe !== slug })
    if (envoltura) {
      envoltura.src = `/sitio/marca/barra-${d.slug}.webp`
      envoltura.alt = `Envoltura de ${d.nombre}`
    }
    if (ilustracion) {
      ilustracion.src = `/sitio/marca/ilustracion-${d.slug}.webp`
      ilustracion.alt = `Ilustración de la envoltura de ${d.nombre}`
    }
  }

  radios.forEach((r, i) => {
    r.addEventListener('click', () => elige(r.dataset.anaquelRadio ?? '', false))
    r.addEventListener('keydown', (e) => {
      const paso =
        e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 :
        e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
      if (!paso) return
      e.preventDefault()
      const destino = radios[(i + paso + radios.length) % radios.length]
      elige(destino.dataset.anaquelRadio ?? '', true)
    })
  })

  // Tabindex rotatorio inicial (solo la seleccionada entra por Tab).
  radios.forEach((r) => { r.tabIndex = r.getAttribute('aria-checked') === 'true' ? 0 : -1 })

  /* ---------- 3c. La barra 3D en la ficha del anaquel ---------- */

  const visor = document.querySelector<HTMLElement>('[data-visor3d]')
  if (visor && !quieto) {
    const observador3d = new IntersectionObserver(
      async ([entrada]) => {
        if (!entrada.isIntersecting) return
        observador3d.disconnect()
        try {
          const aplica = await montarBarra3D(visor, 'La barra en tres dimensiones; arrastra para girarla')
          aplica(slugActual)
          visorElige = aplica
        } catch {
          /* Si el visor no carga, se queda la imagen. La página no se entera. */
        }
      },
      { rootMargin: '250px' },
    )
    observador3d.observe(visor)
  }
}

/* ---------- 3d. El catálogo inmersivo de barras (/barras) ----------
   Una pantalla por sabor con scroll-snap (nunca secuestrado). El
   observador marca el sabor activo: pinta el selector, actualiza el
   hash (#canela es compartible) y le cambia el pliego a la única
   instancia 3D fija. El selector de miniaturas salta a cualquier
   sabor. */

const catalogo = document.querySelector<HTMLElement>('[data-catalogo]')
if (catalogo) {
  const espectros = [...catalogo.querySelectorAll<HTMLElement>('[data-espectro]')]
  const saltos = [...document.querySelectorAll<HTMLButtonElement>('[data-salto]')]
  let aplicar3d: ((slug: string) => void) | null = null
  let slugActivo = location.hash.replace('#', '') || espectros[0]?.id || ''

  const marcaActivo = (slug: string) => {
    if (!slug || slug === slugActivo) return
    slugActivo = slug
    saltos.forEach((b) => {
      b.setAttribute('aria-current', b.dataset.salto === slug ? 'true' : 'false')
    })
    history.replaceState(null, '', `#${slug}`)
    aplicar3d?.(slug)
  }

  const observadorActivo = new IntersectionObserver(
    (entradas) => {
      for (const e of entradas) {
        if (e.isIntersecting) marcaActivo((e.target as HTMLElement).id)
      }
    },
    { threshold: 0.55 },
  )
  espectros.forEach((s) => observadorActivo.observe(s))

  saltos.forEach((b) => {
    b.addEventListener('click', () => {
      document.getElementById(b.dataset.salto ?? '')?.scrollIntoView({
        behavior: quieto ? 'auto' : 'smooth',
      })
    })
  })

  const cajaVisor = document.querySelector<HTMLElement>('[data-catalogo-visor]')
  if (cajaVisor && !quieto) {
    void montarBarra3D(cajaVisor, cajaVisor.dataset.alt ?? '')
      .then((aplica) => {
        aplicar3d = aplica
        raiz.classList.add('catalogo-3d')
        aplica(slugActivo)
      })
      .catch(() => { /* quedan los packshots por sección */ })
  }
}

/* ---------- 4. Copiar correo ---------- */

for (const boton of document.querySelectorAll<HTMLButtonElement>('[data-copiar]')) {
  if (!navigator.clipboard) continue
  boton.hidden = false
  const texto = boton.querySelector<HTMLElement>('[data-copiar-texto]')
  const original = texto?.textContent ?? ''
  boton.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(boton.dataset.copiar ?? '')
      if (texto) texto.textContent = '¡Copiado!'
      setTimeout(() => { if (texto) texto.textContent = original }, 1600)
    } catch {
      /* sin permiso de portapapeles: el mailto sigue ahí */
    }
  })
}

/* ---------- 4b. Formulario de contacto ----------
   Primera opción: POST a /api/contacto (función de Vercel que envía el
   correo por Resend, con honeypot + trampa de tiempo + Turnstile
   opcional). Si la función no está configurada o falla, el respaldo es
   el mailto de siempre. Sin JS, el action mailto del form hace lo
   propio (más crudo, pero funciona). */

const formulario = document.querySelector<HTMLFormElement>('[data-formulario]')
if (formulario) {
  // La trampa de tiempo arranca cuando la página carga.
  const inicio = formulario.querySelector<HTMLInputElement>('[name="inicio"]')
  if (inicio) inicio.value = String(Date.now())

  const botonTexto = formulario.querySelector<HTMLElement>('[data-formulario-boton]')
  const exito = formulario.querySelector<HTMLElement>('[data-formulario-exito]')
  const aviso = formulario.querySelector<HTMLElement>('[data-formulario-aviso]')
  const boton = formulario.querySelector<HTMLButtonElement>('button[type="submit"]')
  const textoOriginal = botonTexto?.textContent ?? ''

  const abreMailto = (datos: FormData) => {
    const esNegocio = datos.get('tipo') === 'negocio'
    const asunto = esNegocio
      ? formulario.dataset.asuntoNegocio ?? ''
      : formulario.dataset.asuntoPersonal ?? ''
    const cuerpo = [
      `Nombre: ${datos.get('nombre')}`,
      `Correo: ${datos.get('correo')}`,
      '',
      String(datos.get('mensaje') ?? ''),
    ].join('\n')
    location.href = `mailto:${formulario.dataset.correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`
  }

  const otra = formulario.querySelector<HTMLButtonElement>('[data-formulario-otra]')
  otra?.addEventListener('click', () => {
    formulario.dataset.estado = ''
    if (exito) exito.hidden = true
    formulario.querySelector<HTMLInputElement>('[name="nombre"]')?.focus()
  })

  formulario.addEventListener('submit', async (e) => {
    e.preventDefault()
    const datos = new FormData(formulario)
    if (aviso) aviso.hidden = true
    if (boton) boton.disabled = true
    formulario.dataset.estado = 'enviando'
    if (botonTexto) botonTexto.textContent = 'Enviando'
    try {
      const respuesta = await fetch('/api/contacto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: datos.get('nombre'),
          correo: datos.get('correo'),
          tipo: datos.get('tipo'),
          mensaje: datos.get('mensaje'),
          apellido: datos.get('apellido'),
          inicio: Number(datos.get('inicio')),
          turnstile: datos.get('cf-turnstile-response'),
        }),
      })
      if (respuesta.ok) {
        formulario.reset()
        if (inicio) inicio.value = String(Date.now())
        formulario.dataset.estado = 'enviado'
        if (exito) {
          exito.hidden = false
          // El foco viaja al sello: el lector de pantalla lo anuncia y
          // el teclado queda sobre «Enviar otro mensaje».
          exito.focus()
        }
        return
      }
      // 503 = función sin configurar; cualquier otro fallo también cae
      // al respaldo para que el mensaje nunca se pierda.
      formulario.dataset.estado = ''
      if (aviso) aviso.hidden = false
      abreMailto(datos)
    } catch {
      formulario.dataset.estado = ''
      if (aviso) aviso.hidden = false
      abreMailto(datos)
    } finally {
      if (formulario.dataset.estado !== 'enviado') formulario.dataset.estado = ''
      if (boton) boton.disabled = false
      if (botonTexto) botonTexto.textContent = textoOriginal
    }
  })
}

/* ---------- 5. Revelado al entrar en pantalla ---------- */

const observador = new IntersectionObserver(
  (entradas) => {
    for (const e of entradas) {
      if (!e.isIntersecting) continue
      e.target.classList.add('visto')
      observador.unobserve(e.target)
    }
  },
  { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
)
for (const el of document.querySelectorAll('[data-revelar]')) observador.observe(el)

/* ---------- 6. Parallax suave ----------
   El motor del canvas: desplazamiento proporcional a la distancia del
   centro de la pieza al centro de la ventana. Apagado con PRM. */

const conParallax = [...document.querySelectorAll<HTMLElement>('[data-parallax]')]
if (!quieto && conParallax.length > 0) {
  let pedido = false
  const ajusta = () => {
    pedido = false
    const vh = innerHeight
    for (const el of conParallax) {
      const r = el.getBoundingClientRect()
      if (r.bottom < -200 || r.top > vh + 200) continue
      const centro = r.top + r.height / 2 - vh / 2
      const factor = Number(el.dataset.parallax ?? 0)
      el.style.transform = `translateY(${(centro * factor).toFixed(1)}px)`
    }
  }
  const pide = () => {
    if (pedido) return
    pedido = true
    requestAnimationFrame(ajusta)
  }
  addEventListener('scroll', pide, { passive: true })
  addEventListener('resize', pide, { passive: true })
  ajusta()
}

/* ---------- 7. Cursor de sello + imanes (transferidos) ---------- */

if (punteroFino && !quieto) {
  raiz.classList.add('cursor-propio')

  const punto = document.createElement('div')
  punto.className = 'cursor'
  const anillo = document.createElement('div')
  anillo.className = 'cursor-anillo'
  const etiqueta = document.createElement('b')
  anillo.appendChild(etiqueta)
  document.body.append(punto, anillo)

  let x = innerWidth / 2
  let y = innerHeight / 2
  let ax = x
  let ay = y
  let escala = 1
  let escalaObjetivo = 1
  let destacado = false
  let seccionActual: Element | null = null

  addEventListener(
    'pointermove',
    (e) => {
      x = e.clientX
      y = e.clientY
      punto.style.opacity = '1'
      anillo.style.opacity = '1'
      punto.style.transform = `translate3d(${x}px, ${y}px, 0)`

      // El cursor toma la tinta de la sección que pisa.
      const bajo = document.elementFromPoint(x, y)?.closest('[data-tono]') ?? null
      if (bajo && bajo !== seccionActual) {
        seccionActual = bajo
        const tinta = getComputedStyle(bajo).getPropertyValue('--texto').trim()
        if (tinta) raiz.style.setProperty('--cursor-color', tinta)
      }
    },
    { passive: true },
  )

  addEventListener('pointerdown', () => { escalaObjetivo = 0.8 })
  addEventListener('pointerup', () => { escalaObjetivo = destacado ? 1.75 : 1 })

  for (const el of document.querySelectorAll<HTMLElement>('[data-cursor]')) {
    el.addEventListener('pointerenter', () => {
      destacado = true
      escalaObjetivo = 1.75
      etiqueta.textContent = el.dataset.cursor ?? ''
      etiqueta.style.opacity = '1'
      anillo.style.background = 'color-mix(in srgb, var(--cursor-color) 10%, transparent)'
    })
    el.addEventListener('pointerleave', () => {
      destacado = false
      escalaObjetivo = 1
      etiqueta.style.opacity = '0'
      anillo.style.background = 'transparent'
    })
  }

  const marco = () => {
    ax += (x - ax) * 0.16
    ay += (y - ay) * 0.16
    escala += (escalaObjetivo - escala) * 0.16
    anillo.style.transform = `translate3d(${ax}px, ${ay}px, 0) scale(${escala})`
    requestAnimationFrame(marco)
  }
  requestAnimationFrame(marco)

  /* Botones magnéticos */
  for (const el of document.querySelectorAll<HTMLElement>('[data-iman]')) {
    el.addEventListener('pointermove', (e) => {
      const caja = el.getBoundingClientRect()
      const dx = e.clientX - (caja.left + caja.width / 2)
      const dy = e.clientY - (caja.top + caja.height / 2)
      el.style.transform = `translate(${dx * 0.18}px, ${dy * 0.24}px)`
      el.style.transition = 'transform 0.12s linear'
    })
    el.addEventListener('pointerleave', () => {
      el.style.transform = ''
      el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    })
  }
}
