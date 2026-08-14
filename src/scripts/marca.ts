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
  const orden = campo('[data-anaquel-orden]')
  const contador = campo('[data-anaquel-contador]')
  const nombre = campo('[data-anaquel-nombre]')
  const precio = campo('[data-anaquel-precio]')
  const cacao = campo('[data-anaquel-cacao]')
  const ingredientes = campo('[data-anaquel-ingredientes]')
  const envoltura = campo<HTMLImageElement>('.ficha-envoltura img')
  const ilustracion = campo<HTMLImageElement>('[data-anaquel-ilustracion]')
  const cta = campo<HTMLAnchorElement>('.ficha-ctas a')

  let slugActual =
    radios.find((r) => r.getAttribute('aria-checked') === 'true')?.dataset.anaquelRadio ?? 'canela'
  // El visor 3D se engancha acá cuando termina de cargar (sección 3c).
  let visorElige: ((slug: string) => void) | null = null

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
    if (orden) orden.textContent = String(d.orden)
    if (contador) contador.textContent = String(d.orden)
    if (nombre) nombre.textContent = d.nombre
    if (precio) precio.textContent = d.precio
    if (cacao) cacao.textContent = d.cacao
    if (ingredientes) ingredientes.textContent = d.ingredientes
    if (envoltura) {
      envoltura.src = `/sitio/marca/barra-${d.slug}.webp`
      envoltura.alt = `Envoltura de ${d.nombre}`
    }
    if (ilustracion) {
      ilustracion.src = `/sitio/marca/ilustracion-${d.slug}.webp`
      ilustracion.alt = `Ilustración de la envoltura de ${d.nombre}`
    }
    // «Ver en el catálogo» apunta al producto del sabor elegido.
    if (cta) cta.href = d.url
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

  /* ---------- 3c. La barra en 3D ----------
     El modelo de Marcos (Blender): UN solo GLB para los quince sabores.
     Al elegir en el anaquel se le cambia la textura del material
     «Label» por el pliego de imprenta del sabor. El visor
     (model-viewer, self-hosteado) se carga recién cuando la ficha entra
     en pantalla; sin JS o con reduced-motion queda la imagen fija. */

  interface VisorModelo extends HTMLElement {
    model?: {
      materials: Array<{
        name: string
        pbrMetallicRoughness: { baseColorTexture: { setTexture(t: unknown): void } }
      }>
    }
    createTexture(uri: string): Promise<unknown>
  }

  const visor = document.querySelector<HTMLElement>('[data-visor3d]')
  if (visor && !quieto) {
    const observador3d = new IntersectionObserver(
      async ([entrada]) => {
        if (!entrada.isIntersecting) return
        observador3d.disconnect()
        try {
          await new Promise<void>((listo, falla) => {
            const s = document.createElement('script')
            s.type = 'module'
            s.src = '/vendor/model-viewer.min.js'
            s.onload = () => listo()
            s.onerror = () => falla(new Error('model-viewer no cargó'))
            document.head.appendChild(s)
          })
          await customElements.whenDefined('model-viewer')

          const mv = document.createElement('model-viewer') as unknown as VisorModelo
          mv.setAttribute('src', visor.dataset.glb ?? '')
          mv.setAttribute('alt', 'La barra en tres dimensiones; arrastra para girarla')
          mv.setAttribute('camera-controls', '')
          mv.setAttribute('disable-zoom', '')
          mv.setAttribute('auto-rotate', '')
          mv.setAttribute('rotation-per-second', '16deg')
          mv.setAttribute('camera-orbit', '12deg 78deg 82%')
          mv.setAttribute('shadow-intensity', '0.8')
          mv.setAttribute('exposure', '1.1')
          mv.setAttribute('interaction-prompt', 'none')

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

          mv.addEventListener('load', () => {
            void aplica(slugActual)
            visor.classList.add('con-3d')
            visorElige = (slug) => { void aplica(slug) }
          })
          visor.appendChild(mv)
        } catch {
          /* Si el visor no carga, se queda la imagen. La página no se entera. */
        }
      },
      { rootMargin: '250px' },
    )
    observador3d.observe(visor)
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
   Sin servidor: el envío arma un mailto con asunto y cuerpo ya
   escritos y lo abre en el correo del visitante. Sin JS, el action
   mailto del form hace lo propio (más crudo, pero funciona). */

const formulario = document.querySelector<HTMLFormElement>('[data-formulario]')
if (formulario) {
  formulario.addEventListener('submit', (e) => {
    e.preventDefault()
    const datos = new FormData(formulario)
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
