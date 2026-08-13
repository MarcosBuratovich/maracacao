/* Comportamiento del sistema editorial (sitio público).

   Todo lo de acá es mejora progresiva: sin JS la página se ve completa
   y quieta (el CSS esconde solo bajo `html.js` + no-preference), y con
   `prefers-reduced-motion` no se registra ni cursor ni imanes.

   Nada busca por id: los SVG inlineados de la marca duplican ids entre
   sí (deuda documentada en el handoff) y esta capa no la hereda. */

export {} // módulo: si no, TypeScript trata el archivo como script global

const raiz = document.documentElement
raiz.classList.add('js')

const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches
const punteroFino = matchMedia('(pointer: fine)').matches

/* ---------- 1. Titulares partidos en líneas ---------- */

function partirLineas(el: HTMLElement) {
  const original = el.dataset.textoOriginal ?? el.textContent ?? ''
  el.dataset.textoOriginal = original

  // Paso 1: cada palabra en su span, para poder medir en qué línea cae.
  el.textContent = ''
  const palabras = original.trim().split(/\s+/).filter(Boolean)
  const spans = palabras.map((p) => {
    const s = document.createElement('span')
    s.textContent = p
    return s
  })
  spans.forEach((s, i) => {
    el.appendChild(s)
    if (i < spans.length - 1) el.appendChild(document.createTextNode(' '))
  })

  // Paso 2: agrupar por posición vertical real y envolver cada línea.
  const lineas: string[][] = []
  let ultimoTop: number | null = null
  for (const s of spans) {
    const top = Math.round(s.offsetTop)
    if (ultimoTop === null || Math.abs(top - ultimoTop) > 2) {
      lineas.push([])
      ultimoTop = top
    }
    lineas[lineas.length - 1].push(s.textContent ?? '')
  }

  el.textContent = ''
  lineas.forEach((palabrasLinea, i) => {
    const mascara = document.createElement('span')
    mascara.className = 'linea'
    const interior = document.createElement('span')
    interior.className = 'linea-int'
    interior.textContent = palabrasLinea.join(' ')
    mascara.style.setProperty('--i', String(i))
    mascara.appendChild(interior)
    el.appendChild(mascara)
  })
}

const titulares = [...document.querySelectorAll<HTMLElement>('[data-lineas]')]
if (!quieto) {
  titulares.forEach(partirLineas)

  let temporizador: ReturnType<typeof setTimeout> | undefined
  let anchoPrevio = innerWidth
  addEventListener('resize', () => {
    if (innerWidth === anchoPrevio) return // el teclado móvil solo cambia el alto
    anchoPrevio = innerWidth
    clearTimeout(temporizador)
    temporizador = setTimeout(() => titulares.forEach(partirLineas), 200)
  })
}

/* ---------- 2. Revelado al entrar en pantalla ---------- */

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
for (const el of document.querySelectorAll('[data-revelar], .marco-foto')) observador.observe(el)

/* ---------- 3. Cursor de sello ---------- */

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

  /* ---------- 4. Botones magnéticos ---------- */

  for (const el of document.querySelectorAll<HTMLElement>('[data-iman]')) {
    el.addEventListener('pointermove', (e) => {
      const caja = el.getBoundingClientRect()
      const dx = e.clientX - (caja.left + caja.width / 2)
      const dy = e.clientY - (caja.top + caja.height / 2)
      el.style.transform = `translate(${dx * 0.22}px, ${dy * 0.3}px)`
      el.style.transition = 'transform 0.12s linear'
    })
    el.addEventListener('pointerleave', () => {
      el.style.transform = ''
      el.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)'
    })
  }
}

/* ---------- 5. El sello se acopla al encabezado ---------- */

const centinela = document.querySelector('[data-centinela]')
if (centinela) {
  const alEncabezado = new IntersectionObserver(
    ([e]) => raiz.classList.toggle('acoplado', !e.isIntersecting),
    { threshold: 0 },
  )
  alEncabezado.observe(centinela)
}

/* ---------- 5b. La barra toma la tinta de la sección que pisa ----------
   Sin esto, un solo color de barra queda ilegible sobre las etiquetas de
   producto (fotos a todo color) o sobre el papel. */

const barra = document.querySelector<HTMLElement>('.barra')
if (barra) {
  let pedido = false
  const ajustarBarra = () => {
    pedido = false
    const alto = barra.getBoundingClientRect().height
    const bajo = document
      .elementsFromPoint(innerWidth / 2, alto / 2)
      .find((el) => el.matches('[data-tono]'))
    if (!bajo) return
    const estilo = getComputedStyle(bajo)
    barra.style.setProperty('--barra-tinta', estilo.getPropertyValue('--texto').trim())
    barra.style.setProperty('--barra-velo', estilo.getPropertyValue('--fondo').trim())
  }
  addEventListener(
    'scroll',
    () => {
      if (pedido) return
      pedido = true
      requestAnimationFrame(ajustarBarra)
    },
    { passive: true },
  )
  ajustarBarra()
}

/* ---------- 5c. Las barras 3D giran con el scroll ----------
   El giro sigue la posición de la barra en la pantalla: entra mostrando
   el canto y termina de frente. Con reduced-motion no se registra nada y
   quedan en su pose fija de CSS, que es como se ve un producto en foto. */

const barras = [...document.querySelectorAll<HTMLElement>('[data-barra3d]')]
if (barras.length && !quieto) {
  let pedido = false

  const girar = () => {
    pedido = false
    for (const b of barras) {
      const caja = b.getBoundingClientRect()
      if (caja.bottom < -200 || caja.top > innerHeight + 200) continue
      // 0 = recién entra por abajo, 1 = ya salió por arriba
      const t = 1 - (caja.top + caja.height / 2) / (innerHeight + caja.height)
      // ±32°: más que eso y la barra se pone de canto y deja de leerse
      // como producto.
      b.style.setProperty('--giro-y', `${((0.5 - t) * 64).toFixed(2)}deg`)
      b.style.setProperty('--giro-x', `${(-7 + (0.5 - t) * 6).toFixed(2)}deg`)
    }
  }

  addEventListener('scroll', () => {
    if (pedido) return
    pedido = true
    requestAnimationFrame(girar)
  }, { passive: true })
  girar()

  // Con puntero fino, el mouse manda mientras esté encima.
  if (punteroFino) {
    for (const b of barras) {
      b.addEventListener('pointermove', (e) => {
        const caja = b.getBoundingClientRect()
        const dx = (e.clientX - (caja.left + caja.width / 2)) / caja.width
        const dy = (e.clientY - (caja.top + caja.height / 2)) / caja.height
        b.style.setProperty('--giro-y', `${(dx * 52).toFixed(2)}deg`)
        b.style.setProperty('--giro-x', `${(-dy * 20).toFixed(2)}deg`)
      })
      b.addEventListener('pointerleave', girar)
    }
  }
}

/* ---------- 6. Video del personaje ---------- */

const video = document.querySelector('video')
if (video instanceof HTMLVideoElement && quieto) {
  video.autoplay = false
  video.controls = true
  video.pause()
}
