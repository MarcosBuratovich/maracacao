/** Milisegundos. Rangos fijados en §12 del spec. */
export const duraciones = {
  micro: 160,
  gesto: 400,
  ambiental: 3200,
  /** Ciclo completo del parpadeo. El cierre ocupa una fracción mínima. */
  parpadeo: 6000,
} as const

/** Spring suave por defecto: las cosas con masa no arrancan lineales. */
export const easings = {
  spring: 'linear(0, 0.02, 0.4 12%, 0.87 26%, 1.06 38%, 1.01 62%, 1)',
  salida: 'cubic-bezier(0.4, 0, 1, 1)',
  entrada: 'cubic-bezier(0, 0, 0.2, 1)',
} as const

/** Amplitudes de la animación ambiental. */
export const amplitudes = {
  respiracionEscala: 1.02,
  colaGrados: 6,
  parpadeoMinMs: 4000,
  parpadeoMaxMs: 7000,
} as const
