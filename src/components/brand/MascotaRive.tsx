import { useEffect, useState } from 'react'
import { useRive } from '@rive-app/react-canvas'
import { copy } from '@/copy/marca'

interface Props {
  /** Ruta pública al `.riv`. Puede no existir todavía — ver el fallback. */
  src: string
  /** SVG ya tokenizado (mismo que usa <Mascota/> sin `rive`), como string. */
  fallback: string
  class?: string
}

/**
 * Isla de Rive para <Mascota rive />. Único archivo del sitio que conoce
 * `@rive-app/react-canvas` — Mascota.astro nunca lo importa (test: "no
 * importa Rive en el módulo de nivel superior de Astro").
 *
 * Contrato de fallback (spec §11.4 y principio §12.7, "apaga, no atenúa"):
 *   1. Bajo prefers-reduced-motion, el rig ni se pide ni se monta — cero
 *      fetch del .riv, cero runtime de Rive booteado. Se ve el SVG estático
 *      de siempre (con su propia animación CSS ambiental, que la hoja
 *      mascota-ambiental.css ya apaga por su cuenta bajo el mismo media
 *      query).
 *   2. Si no hay reduced-motion, se arranca SIEMPRE mostrando el fallback y
 *      se reemplaza recién cuando `rive` (la instancia devuelta por
 *      useRive) confirma que cargó. Si `public/brand/mono.riv` no existe
 *      todavía, o el fetch falla, o tarda — el fallback se queda puesto
 *      indefinidamente y el sitio nunca se entera ni se rompe.
 */
export default function MascotaRive({ src, fallback, class: clase = '' }: Props) {
  // Arranca en `false` tanto en el render de servidor (Astro con
  // client:visible primero renderiza en Node, donde `window` no existe) como
  // en el primer render del cliente, así hidratación y servidor coinciden
  // sin parpadeo. Recién en el efecto —solo corre en el navegador— se sabe
  // la preferencia real.
  const [permitido, setPermitido] = useState(false)

  useEffect(() => {
    const consulta = window.matchMedia('(prefers-reduced-motion: reduce)')
    const evaluar = () => setPermitido(!consulta.matches)
    evaluar()
    // Vivo, no solo al montar: si alguien cambia la preferencia del SO con
    // la pestaña abierta, el rig se apaga (o se habilita) sin recargar.
    consulta.addEventListener('change', evaluar)
    return () => consulta.removeEventListener('change', evaluar)
  }, [])

  // `null` cuando no está permitido: useRive no intenta construir ninguna
  // instancia de Rive en ese caso (ni siquiera pide `src`) — es lo que hace
  // que "no monta bajo reduced-motion" sea literal y no solo visual.
  const { rive, RiveComponent } = useRive(
    permitido ? { src, stateMachines: 'MonoSM', autoplay: true } : null,
  )

  const riveLoaded = permitido && Boolean(rive)

  return (
    // role="img" + aria-label acá (no solo en el SVG del fallback, que trae
    // el suyo propio incrustado): el <canvas> de Rive no tiene nombre
    // accesible propio, así que sin esto el mono queda mudo para lectores de
    // pantalla en cuanto el rig reemplaza al fallback.
    <div className={`mascota ${clase}`} role="img" aria-label={copy.mascotaAria}>
      {!riveLoaded && <div dangerouslySetInnerHTML={{ __html: fallback }} />}
      {permitido && (
        <RiveComponent style={{ display: riveLoaded ? 'block' : 'none' }} />
      )}
    </div>
  )
}
