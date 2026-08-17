/* Las fichas oficiales — datos compartidos entre el generador de PDFs
 * (pnpm fichas) y el generador en línea (/fichas), que las usa como
 * punto de partida editable. Contenido VERBATIM de los documentos del
 * cliente (2026-08-14 barras/gotas, 2026-08-17 polvo) con limpieza
 * tipográfica mínima. */
import { marca } from '@/tokens/color'
import { p, li, type Ficha } from './plantilla'

export const fichasBase: Ficha[] = [
  {
    archivo: 'ficha-tecnica-barras-y-gotas',
    producto: 'Chocolate 70% cacao',
    denominacion: 'Chocolate oscuro 70% cacao saborizado con esencias naturales y/o especias',
    acento: marca.rojoHondo,
    meta: [
      ['Marca', 'Maracacao'],
      ['País de elaboración', 'México'],
      ['Presentaciones', 'Barra 70 g · Gotas 250 g (piezas de ±10 g)'],
      ['Vida de anaquel', 'Dos años en condiciones sugeridas'],
    ],
    secciones: [
      {
        titulo: 'Descripción del producto',
        bloques: [
          p('Chocolate oscuro con 70% de cacao, elaborado a partir de chocolate extra oscuro 70% cacao y adicionado con esencias naturales grado alimenticio y/o especias naturales seleccionadas.'),
          p('Producto de sabor intenso a cacao, con notas aromáticas características de la esencia o especia utilizada. Las diferentes variedades Maracacao mantienen como base el mismo chocolate 70% cacao y se diferencian por la esencia natural, especia o combinación utilizada.'),
        ],
      },
      {
        titulo: 'Ingredientes base',
        bloques: [
          p('Licor de cacao, azúcar, manteca de cacao, lecitina de soya y extracto natural de vainilla. Según la variedad se adicionan esencias naturales grado alimenticio y/o especias naturales. Los ingredientes específicos del sabor se declaran en la etiqueta de cada variedad.'),
        ],
      },
      {
        titulo: 'Alérgenos',
        bloques: [p('Contiene soya. Puede contener leche y frutos de cáscara.')],
      },
      {
        titulo: 'Características organolépticas',
        bloques: [
          li(
            'Color: marrón oscuro.',
            'Aroma: característico a chocolate, complementado por las notas propias de la esencia o especia utilizada.',
            'Sabor: característico a chocolate oscuro 70% cacao, libre de sabores anormales y con notas propias de la variedad.',
            'Textura: sólida, firme y homogénea a temperatura ambiente.',
            'Formato: barras (tableta sólida de 70 g) y gotas (piezas de ±10 g en presentación de 250 g).',
          ),
        ],
      },
      {
        titulo: 'Información nutrimental de referencia',
        bloques: [
          p('Valores promedio por 100 g de chocolate base:'),
          {
            tipo: 'tabla',
            encabezados: ['Nutrimento', 'Por 100 g'],
            filas: [
              ['Contenido energético', '600 kcal / 2,510 kJ'],
              ['Grasas totales', '44 g'],
              ['Grasas saturadas', '27 g'],
              ['Grasas trans', '0 g'],
              ['Carbohidratos', '45 g'],
              ['Azúcares totales', '30 g'],
              ['Azúcares añadidos', '29 g'],
              ['Proteínas', '8 g'],
              ['Fibra dietética', '15 g'],
              ['Sodio', '0 g'],
            ],
          },
        ],
      },
      {
        titulo: 'Parámetros de la materia prima',
        bloques: [
          li(
            'Humedad: menor a 1%.',
            'Micrometría: 18–22 µm.',
            'Viscosidad Casson: 500–1,100 mPa·s.',
            'Límite de fluencia Casson: 5–13 Pa.',
          ),
        ],
      },
      {
        titulo: 'Usos',
        bloques: [
          li(
            'Barras de 70 g: producto listo para consumo directo.',
            'Gotas de 10 g: consumo directo y aplicaciones en bebidas, repostería, chocolatería y postres.',
          ),
        ],
      },
      {
        titulo: 'Almacenamiento',
        bloques: [
          p('Conservar en un lugar limpio, fresco y seco, protegido de la luz directa, olores fuertes y fuentes de calor. Temperatura recomendada: 16–20 °C. Humedad relativa: inferior al 60%. Mantener bien cerrado después de abrir. No requiere refrigeración en condiciones normales.'),
        ],
      },
    ],
  },
  {
    archivo: 'ficha-tecnica-chocolate-en-polvo',
    producto: 'Chocolate en polvo',
    denominacion: 'Mezcla en polvo para preparar bebida de chocolate',
    acento: marca.tinta,
    meta: [
      ['Marca', 'Maracacao'],
      ['País de origen', 'México'],
      ['Presentaciones', '250 g · 1 kg'],
      ['Vida de anaquel', 'Dos años en condiciones sugeridas'],
    ],
    secciones: [
      {
        titulo: 'Descripción del producto',
        bloques: [
          p('Chocolate en polvo elaborado con azúcar, cocoa natural, pasta de cacao y cocoa alcalina. La combinación de cocoa natural, cocoa alcalinizada y pasta de cacao aporta color oscuro, aroma y sabor característicos del cacao. Producto diseñado para preparación de bebidas calientes con leche o agua.'),
        ],
      },
      {
        titulo: 'Fórmula del producto',
        bloques: [
          {
            tipo: 'tabla',
            encabezados: ['Ingrediente', 'Porcentaje', 'Por 1 kg'],
            filas: [
              ['Azúcar', '70.60%', '706 g'],
              ['Cocoa natural', '12.00%', '120 g'],
              ['Pasta de cacao', '11.00%', '110 g'],
              ['Cocoa alcalina', '6.00%', '60 g'],
              ['Dióxido de silicio (antiaglomerante)', '0.40%', '4 g'],
              ['Total', '100.00%', '1,000 g'],
            ],
          },
        ],
      },
      {
        titulo: 'Ingredientes',
        bloques: [p('Azúcar, cocoa natural, pasta de cacao, cocoa alcalina y dióxido de silicio (antiaglomerante).')],
      },
      {
        titulo: 'Información nutrimental calculada',
        bloques: [
          p('Por 100 g de producto:'),
          {
            tipo: 'tabla',
            encabezados: ['Nutrimento', 'Cantidad'],
            filas: [
              ['Contenido energético', '395 kcal / 1,654 kJ'],
              ['Proteínas', '6.0 g'],
              ['Grasas totales', '7.8 g'],
              ['Grasas saturadas', '4.5 g'],
              ['Grasas trans', '2.2 mg'],
              ['Hidratos de carbono disponibles', '75.4 g'],
              ['Azúcares', '70.6 g'],
              ['Azúcares añadidos', '70.6 g'],
              ['Fibra dietética', '7.7 g'],
              ['Sodio', '13 mg'],
            ],
          },
          p('Valores calculados a partir de la fórmula del producto y de las declaraciones nutrimentales por 100 g de las materias primas utilizadas.'),
        ],
      },
      {
        titulo: 'Características organolépticas',
        bloques: [
          p('Polvo fino, seco, fluido y homogéneo, de color café oscuro. Aroma característico de cacao y chocolate; sabor dulce, intenso y característico del cacao. Materia extraña: ausente bajo condiciones adecuadas de elaboración y manejo.'),
        ],
      },
      {
        titulo: 'Modo de preparación sugerido',
        bloques: [
          p('Agregar aproximadamente 30 g de chocolate en polvo a 200 ml de leche o agua caliente y mezclar hasta obtener una bebida homogénea. La concentración puede ajustarse al gusto.'),
        ],
      },
      {
        titulo: 'Conservación y control',
        bloques: [
          p('Mantener el envase bien cerrado, en lugar fresco y seco, protegido de humedad, sol directo, fuentes de calor y olores fuertes. Lote y consumo preferente: identificados en el envase. La formulación y la información nutrimental por 100 g son las mismas para ambas presentaciones.'),
        ],
      },
    ],
  },
]
