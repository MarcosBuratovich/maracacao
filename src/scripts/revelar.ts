// Revelado por scroll compartido (presentación y borrador del sitio).
// Trabaja por data-attribute y clases — nunca buscando por id: los ids de
// los SVG inlineados están duplicados (deuda documentada en el handoff).
// El estado oculto inicial solo existe bajo html.js + PRM off (landing.css),
// así que sin JS o con reduced-motion la página se ve completa.
document.documentElement.classList.add('js')

const observador = new IntersectionObserver(
  (entradas) => {
    for (const e of entradas) {
      if (e.isIntersecting) {
        e.target.classList.add('revelado')
        observador.unobserve(e.target)
      }
    }
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
)
for (const el of document.querySelectorAll('[data-revelar]')) observador.observe(el)
