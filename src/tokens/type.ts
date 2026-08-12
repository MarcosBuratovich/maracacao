export const familias = {
  // Identidad original (proyecto 1): el manual de marca sigue en estas.
  display: "'Fraunces Variable', Fraunces, Georgia, serif",
  texto: "'Work Sans Variable', 'Work Sans', system-ui, sans-serif",
  /**
   * Sitio público, 2026-08-12. La marca cambió de logo a un sello con
   * wordmark en serif clásica letterspaceada; Fraunces (soft/wonky) le
   * peleaba. `sello` es la voz del logotipo replicada en la página;
   * `sans` es geométrica —linaje Futura, el del modernismo gráfico
   * mexicano— para datos, etiquetas y cuerpo corto.
   */
  sello: "'Cormorant Garamond', Garamond, 'Times New Roman', serif",
  sans: "'Jost', 'Futura', system-ui, sans-serif",
} as const

/** Valores de partida de los ejes variables. Ver §7 del spec. */
export const ejesFraunces = { SOFT: 60, WONK: 1, opsz: 32 } as const

export const escala = {
  'display-xl': '3.5rem',
  'display-l': '2.5rem',
  'titulo': '1.75rem',
  'subtitulo': '1.25rem',
  'cuerpo': '1rem',
  'menor': '0.875rem',
  'etiqueta': '0.75rem',
} as const
