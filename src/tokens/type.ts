export const familias = {
  // Identidad original (proyecto 1): el manual de marca sigue en estas.
  display: "'Fraunces Variable', Fraunces, Georgia, serif",
  texto: "'Work Sans Variable', 'Work Sans', system-ui, sans-serif",
  /**
   * Sitio público, 2026-08-12. La marca cambió de logo a un sello con
   * wordmark en serif clásica letterspaceada; Fraunces (soft/wonky) le
   * peleaba. `sello` es la voz del logotipo replicada en la página.
   *
   * Para el cuerpo el sitio usa `texto` (Work Sans). Se probaron cinco
   * candidatas a tamaño real sobre los colores de marca: Jost resultó la
   * menos legible (altura-x chica y formas geométricas cerradas) y Work
   * Sans de las más claras — y además ya es la tipografía de texto que
   * documenta el manual, así que sitio y manual hablan igual.
   */
  sello: "'Cormorant Garamond', 'Cormorant respaldo', Garamond, 'Times New Roman', serif",
  /**
   * Rediseño 2026-08-13 (claude.ai/design): las voces del EMPAQUE.
   * `titular` = Bricolage Grotesque 700/800 (los H1/H2 del canvas);
   * `serifMarca` = Trocchi, la serif real de los PDF (nombres de sabor,
   * cuerpo); `mono` = Courier Prime, la de los ingredientes impresos;
   * `mano` = Patrick Hand como sustituto de Bryndan Write, la letra a
   * mano del impreso (pedir el TTF al diseñador para fidelidad total).
   */
  // Los «respaldo» son caras métricas (fuentes-marca.css): la fuente
  // local ajustada con size-adjust para que el swap no mueva el texto.
  titular: "'Bricolage Grotesque', 'Bricolage respaldo', 'Work Sans Variable', system-ui, sans-serif",
  serifMarca: "'Trocchi', 'Trocchi respaldo', Georgia, serif",
  mono: "'Courier Prime', 'Courier New', monospace",
  mano: "'Patrick Hand', 'Bryndan Write', 'Segoe Print', cursive",
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
