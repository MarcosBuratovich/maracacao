/**
 * Contrato de estructura de mascota.svg. Ver §9.2 del spec.
 * El orden del array ES el orden de pintado (primero = más atrás).
 */
export const JERARQUIA = [
  { id: 'escena', padre: null },
  { id: 'suelo', padre: 'escena' },
  { id: 'granos-orbita', padre: 'escena' },
  { id: 'mono', padre: 'escena' },
  { id: 'cola', padre: 'mono' },
  { id: 'pierna-post', padre: 'mono' },
  { id: 'pie-post', padre: 'pierna-post' },
  { id: 'cuerpo', padre: 'mono' },
  { id: 'pierna-apoyo', padre: 'mono' },
  { id: 'pie-apoyo', padre: 'pierna-apoyo' },
  { id: 'brazo-l', padre: 'mono' },
  { id: 'bowl', padre: 'mono' },
  { id: 'bowl-cuenco', padre: 'bowl' },
  { id: 'bowl-contenido', padre: 'bowl' },
  { id: 'bowl-borde', padre: 'bowl' },
  { id: 'brazo-r', padre: 'mono' },
  { id: 'mano-r', padre: 'brazo-r' },
  { id: 'cabeza', padre: 'mono' },
  { id: 'oreja-l', padre: 'cabeza' },
  { id: 'oreja-r', padre: 'cabeza' },
  { id: 'craneo', padre: 'cabeza' },
  { id: 'rostro', padre: 'cabeza' },
  { id: 'ojo-l', padre: 'cabeza' },
  { id: 'ojo-r', padre: 'cabeza' },
  { id: 'cachete-l', padre: 'cabeza' },
  { id: 'cachete-r', padre: 'cabeza' },
  { id: 'nariz', padre: 'cabeza' },
  { id: 'boca', padre: 'cabeza' },
  // La mano izquierda cuelga de #mono, no de #brazo-l: va después de la cabeza
  // porque en la referencia la mano y el pistache se pintan por delante de la
  // cara. En Rive se emparenta al hueso del brazo izquierdo; acá el orden ES
  // el orden de pintado y es lo único que decide quién tapa a quién.
  { id: 'mano-l', padre: 'mono' },
  { id: 'chispas', padre: 'mono' },
  { id: 'pivotes', padre: null },
] as const

/** Grupos con pivote anatómico. La clave es el id del grupo. */
export const PIVOTES = {
  'cola': 'cadera',
  'pierna-post': 'cadera',
  'pie-post': 'tobillo',
  'pierna-apoyo': 'cadera',
  'pie-apoyo': 'tobillo',
  'brazo-l': 'hombro',
  'mano-l': 'muñeca',
  'brazo-r': 'hombro',
  'mano-r': 'muñeca',
  'cabeza': 'base del cuello',
  'oreja-l': 'unión al cráneo',
  'oreja-r': 'unión al cráneo',
  'ojo-l': 'centro del ojo',
  'ojo-r': 'centro del ojo',
} as const
