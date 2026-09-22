/*
 * El historial (Tarea 5, fase 6): «lo primero que ve al abrir es el
 * resultado de su última publicación» (spec §4.5), más la lista completa
 * para cuando quiera mirar atrás (spec §4.6). Solo pinta: toda la decisión
 * —cómo se lee la fecha, quién la publicó, cómo se distingue un deshacer—
 * vive en `./historial`, puro y ya probado ahí sin montar nada.
 *
 * `PantallaEditando` (`App.tsx`) solo llama a este componente cuando ya hay
 * al menos una publicación: la primera vez legítima (cero publicaciones) la
 * sigue resolviendo `App.tsx` con el mismo aviso de siempre
 * (`textoPublicaciones(0)`), sin pasar por acá.
 */
import { useState } from 'react'
import type { Publicada } from './api'
import { filaDeHistorial, resumenUltimaPublicacion } from './historial'

export default function Historial({ publicaciones, ahora: ahoraFijo }: { publicaciones: Publicada[]; ahora?: number }) {
  // Capturado UNA vez, al montar — nunca `Date.now()` suelto adentro del
  // render, mismo criterio que `Sesion.tsx`. No hace falta que se actualice
  // solo: a diferencia del botón «Deshacer» (que deja de poder usarse a los
  // 30 minutos), acá nada cambia de estado con el correr de los minutos.
  //
  // [2026-09-22] El reloj se puede INYECTAR, y por eso `ahora` es opcional.
  // Sin esto, un test que renderice este componente queda atado al reloj de
  // la máquina: el primero que se escribió fijaba una fecha absoluta y
  // esperaba «hoy a las 09:03», así que pasó el día que se escribió y
  // rompió el build de `main` a la mañana siguiente, cuando esa misma fecha
  // pasó a ser «ayer». Y romper el build de `main` no es un test molesto:
  // `pnpm build` es el `buildCommand` de Vercel, así que mientras esté rojo
  // la clienta no puede publicar.
  const [ahoraDelMontaje] = useState(() => Date.now())
  const ahora = ahoraFijo ?? ahoraDelMontaje

  const resumen = resumenUltimaPublicacion(publicaciones, ahora)
  if (resumen === null) return null

  return (
    <div className="panel-historial">
      <p className="panel-aviso" role="status">
        {resumen}
      </p>
      <details className="panel-historial-caja">
        <summary className="panel-historial-resumen">Ver tu historial completo ({publicaciones.length})</summary>
        <ul className="panel-historial-lista">
          {publicaciones.map((p) => {
            const fila = filaDeHistorial(p, publicaciones, ahora)
            return (
              <li
                key={p.sha}
                className={fila.esReversion ? 'panel-historial-fila panel-historial-fila-deshace' : 'panel-historial-fila'}
              >
                <p className="panel-historial-titulo">{fila.titulo}</p>
                <p className="panel-historial-meta">
                  {fila.quien} · {fila.cuando}
                </p>
              </li>
            )
          })}
        </ul>
      </details>
    </div>
  )
}
