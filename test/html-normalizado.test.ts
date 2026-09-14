import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseHTML } from 'linkedom'
import { normaliza } from './lib/html-normalizado'

const env = (cuerpo: string) => `<html><head></head><body>${cuerpo}</body></html>`

// Todos los casos a mano llevan `data-astro-cid-xxxxxxxx` en cada elemento,
// como hace Astro de verdad con cualquier elemento que sale de un
// componente con <style> — index.astro tiene uno. Sin ese estampado, un
// caso a mano no prueba nada sobre el HTML que el sitio construye: es
// justo la forma que le faltaba a esta suite y que dejó pasar cuatro
// revisiones sin detectar que la regla del span nunca disparaba.
const CID = 'data-astro-cid-xxxxxxxx'

describe('el normalizador de HTML de la fase 2', () => {
  it('borra data-campo y data-campo-attr, y deja el resto igual', () => {
    const antes = env(`<p class="mono" ${CID}>Hola</p>`)
    const despues = env(`<p class="mono" data-campo="hero.sub" ${CID}>Hola</p>`)
    expect(normaliza(despues)).toBe(normaliza(antes))

    // Y el de atributo, que es el que la Parte B va a usar en los quince
    // campos que viven adentro de un `alt`, un `aria-label`, un
    // `data-copiar` o un `content`. Sin este caso, la línea que lo borra
    // no la probaba nada.
    const conAttr = env(
      `<img src="x.webp" alt="Envoltura de canela" data-campo-attr="alt:anaquel.envolturaAltPrefijo" ${CID}>`
    )
    const sinAttr = env(`<img src="x.webp" alt="Envoltura de canela" ${CID}>`)
    expect(normaliza(conAttr)).toBe(normaliza(sinAttr))
  })

  it('desenvuelve el span que la fase 2 inventó (el caso de la Parte B)', () => {
    // El caso de index.astro:317 — «Ingredientes: cacao.» es un solo nodo
    // de texto hoy, y marcar la etiqueta obliga a envolverla. El <span>
    // que la Parte B agrega sale con el data-astro-cid del componente
    // puesto encima, como cualquier otro elemento de index.astro. Por eso
    // este caso, con la regla vieja —«¿el span quedó en cero atributos
    // después de sacarle data-campo?»— da ROJO: al span siempre le queda
    // ese uno, el hash de Astro, así que nunca lo desenvolvía. Es el bug
    // que arregla esta regla.
    const antes = env(`<p ${CID}>Ingredientes: cacao.</p>`)
    const despues = env(
      `<p ${CID}><span data-campo="anaquel.ingredientesEtiqueta" ${CID}>Ingredientes</span>: cacao.</p>`
    )
    expect(normaliza(despues)).toBe(normaliza(antes))
  })

  it('NO desenvuelve un span que ya existía, aunque le pongan data-campo', () => {
    // Si lo desenvolviera, la fase 2 podría borrar un <span class="mono">
    // de verdad y el verificador no lo vería.
    const antes = env(`<p ${CID}><span class="mono" ${CID}>$108</span></p>`)
    const despues = env(`<p ${CID}><span class="mono" data-campo="minis.precio" ${CID}>$108</span></p>`)
    expect(normaliza(despues)).toBe(normaliza(antes))
    expect(normaliza(despues)).toContain('class="mono"')
  })

  it('NO desenvuelve un span que solo trae el estampado de Astro, sin data-campo', () => {
    // Caso pensado para clavar el `teniaCampo &&` de la regla: este
    // <span> entra al recorrido porque tiene `data-campo-attr` —nunca
    // `data-campo`— y, sacándoselo junto con el estampado de Astro, no le
    // queda nada más: tan «pelado», mirado desde afuera, como el span que
    // la Parte B inventa en el caso de arriba. Lo único que lo distingue
    // es que ESTE nunca trajo `data-campo`. Sin el `teniaCampo &&` de la
    // condición, este span se desenvolvería igual que el de la Parte B, y
    // un <span> real se perdería sin que el verificador lo note.
    //
    // Ojo: la combinación es de laboratorio, no un patrón que la Parte B
    // vaya a escribir —un `data-campo-attr` de verdad va sobre un elemento
    // que ya tiene el atributo que se marca (`alt`, `title`), así que algo
    // le queda. Está acá porque es la ÚNICA forma de clavar el
    // `teniaCampo &&`: un span pelado sin ningún data-* ni siquiera entra
    // al recorrido, así que con ese no se puede probar nada.
    const conAttr = env(`<p ${CID}><span data-campo-attr="title:x" ${CID}>10</span></p>`)
    const sinAttr = env(`<p ${CID}><span ${CID}>10</span></p>`)
    expect(normaliza(conAttr)).toBe(normaliza(sinAttr))
    expect(normaliza(conAttr)).toContain('<span')
  })

  it('ve borrado un span pelado preexistente, aunque nadie le haya tocado data-campo', () => {
    // Esta es la ganancia sobre la regla vieja: un <span> que YA vivía ahí
    // sin data-campo —«pelado» salvo por el estampado de Astro— nunca
    // entra al recorrido (no tiene ni data-campo ni data-campo-attr), así
    // que la normalización de "antes" lo deja intacto. Si la fase 2 lo
    // borra por error, "después" ya no lo tiene, y la comparación lo ve.
    // La regla vieja, en cambio, lo hubiera desenvuelto en los dos lados
    // igual —a mano, sin el hash de Astro, quedaba en cero atributos— y
    // hubiera escondido el borrado.
    const antes = env(`<p ${CID}><span ${CID}>x</span> resto</p>`)
    const despues = env(`<p ${CID}> resto</p>`)
    expect(normaliza(despues)).not.toBe(normaliza(antes))
  })

  it('ve un cambio de contenido de verdad', () => {
    // La razón de ser del verificador: que NO sea un espejo.
    const antes = env(`<p ${CID}>Hola</p>`)
    const despues = env(`<p data-campo="x" ${CID}>Chau</p>`)
    expect(normaliza(despues)).not.toBe(normaliza(antes))
  })

  it('ve un elemento borrado, aunque le hayan puesto data-campo al vecino', () => {
    const antes = env(`<p ${CID}>Uno</p><p ${CID}>Dos</p>`)
    const despues = env(`<p data-campo="a" ${CID}>Uno</p>`)
    expect(normaliza(despues)).not.toBe(normaliza(antes))
  })
})

describe('el supuesto que hace exacta la regla del span', () => {
  it('todo <span> del HTML construido trae un data-astro-cid-*', () => {
    // Esta es la garantía real de la que depende «pelado = no le queda
    // nada más que el estampado de Astro»: index.astro (y todo componente
    // con <style>) estampa data-astro-cid-<hash> en cada elemento que
    // renderiza, sin excepción. El test viejo («no hay spans sin ningún
    // atributo») medía esto mismo pero por la razón equivocada — daba en
    // cero porque el estampado SIEMPRE deja al menos un atributo, no
    // porque no hubiera spans pelados de verdad. Era tautológico: nunca
    // podía fallar contra HTML de Astro. Este test clava el supuesto
    // correcto: si una versión futura de Astro deja de estampar, esto
    // avisa ANTES de que la regla del span vuelva a quedar ciega en
    // silencio.
    const paginas = ['dist/index.html', 'dist/404.html', 'dist/fichas-tecnicas/index.html']
    if (!existsSync(paginas[0]) && !(process.env.CI || process.env.VERCEL)) {
      console.warn('\n[normalizado] Falta dist/: se salta. Corré `pnpm build:sitio`.')
      return
    }
    for (const p of paginas) {
      const { document } = parseHTML(readFileSync(p, 'utf8'))
      const spans = [...document.querySelectorAll('span')]
      expect(spans.length, `${p}: no tiene ni un span, el test no prueba nada`).toBeGreaterThan(0)
      const sinEstampa = spans.filter(
        (s) => ![...s.attributes].some((a) => a.name.startsWith('data-astro-cid-'))
      )
      expect(sinEstampa.map((s) => s.outerHTML), p).toEqual([])
    }
  })
})

describe('el HTML renderizado, contra la foto de antes de la fase 2', () => {
  // Es el verificador de toda la fase. Cada tarea que cambie el HTML a
  // propósito lo pone rojo, y ahí hay que leer el diff y recapturar en el
  // mismo commit, explicando qué cambió. Esa fricción es el punto: sin
  // ella, el verificador se vuelve un espejo.
  it('las once páginas son idénticas salvo lo que la fase 2 puede agregar', () => {
    const dir = 'test/fixtures/html-antes-fase-2'
    if (!existsSync('dist/index.html') && !(process.env.CI || process.env.VERCEL)) {
      console.warn('\n[normalizado] Falta dist/: se salta. Corré `pnpm build:sitio`.')
      return
    }
    expect(existsSync('dist/index.html')).toBe(true)
    for (const archivo of readdirSync(dir).sort()) {
      const enDist = 'dist/' + archivo.replace(/__/g, '/')
      expect(existsSync(enDist), `${archivo} ya no se construye`).toBe(true)
      expect(normaliza(readFileSync(enDist, 'utf8')), archivo)
        .toBe(normaliza(readFileSync(join(dir, archivo), 'utf8')))
    }
  })
})
