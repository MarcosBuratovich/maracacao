/**
 * Crea el Google Form del cuestionario de Maracacao en tu cuenta.
 * Mantener en sync con docs/cuestionario-sitio.md (la fuente).
 *
 * Cómo usarlo (1 minuto):
 *   1. Entra a https://script.google.com con tu cuenta de Google.
 *   2. "Nuevo proyecto", borra lo que haya y pega este archivo entero.
 *   3. Botón "Ejecutar" (▶). La primera vez pide autorizar tu cuenta.
 *   4. Abajo, en "Registro de ejecución", salen dos enlaces: el de
 *      EDITAR (para ti) y el de RESPONDER (ese se manda al cliente).
 *   El formulario queda guardado en tu Drive; las respuestas se ven ahí
 *   mismo o se vuelcan a una hoja de cálculo con un clic.
 */
function crearFormulario() {
  const form = FormApp.create('Maracacao — Lo que falta para armar la página');
  form.setDescription(
    'Ya quedó: el logo es el del empaque, la página va sin fotos de ustedes y ' +
    'la fecha es el 31 de agosto. Del catálogo en línea ya tomé sabores, ' +
    'presentaciones y precios. Esto es lo que me falta. Si algo es más fácil ' +
    'por audio de WhatsApp, mándenlo así.'
  );

  const texto = (titulo) => form.addParagraphTextItem().setTitle(titulo);
  const seccion = (titulo) => form.addPageBreakItem().setTitle(titulo);
  const algoMas = (tema) => texto('Algo más sobre ' + tema + ':');

  // ——— Quiénes somos ———
  seccion('Quiénes somos');
  texto('1. ¿Qué va aquí: nombres y qué hace cada quien, o solo la historia de la marca? (Sin fotos, ya quedó.)');
  texto('2. ¿Dónde hacen el chocolate y desde cuándo?');
  texto('3. Cuéntenme cómo empezó Maracacao. Con 4 a 6 líneas basta (o mándenme un audio por WhatsApp y aquí lo anotan).');
  texto('4. ¿De dónde viene su cacao y qué de eso quieren contar? (región, productores, lo que se pueda decir con confianza)');
  algoMas('Quiénes somos');

  // ——— El ABC del chocolate ———
  seccion('El ABC del chocolate');
  form.addCheckboxItem()
    .setTitle('5. ¿Qué le quieren enseñar a la gente aquí? Marquen lo que sí va:')
    .setChoiceValues([
      'Qué significa el porcentaje de cacao',
      'Cómo catar un chocolate',
      'Cómo guardarlo',
      'Por qué sin saborizantes ni aditivos',
      'Los beneficios del cacao',
      'El proceso del grano a la barra',
    ])
    .showOtherOption(true);
  texto('6. Pásenme los textos que ya tengan sobre estos temas (péguenlos aquí o mándenlos por correo).');
  texto('7. Sobre los beneficios (digestivo, compuestos bioactivos): ¿qué tan fuerte lo quieren decir? Conviene decirlo con cuidado por el tema de COFEPRIS.');
  algoMas('el ABC del chocolate');

  // ——— Nuestros productos ———
  seccion('Nuestros productos');
  texto('8. En el catálogo conté 15 barras y ustedes mencionaron 16 sabores: ¿falta alguno? Pásenme el porcentaje de cacao de cada barra, tal como aparece en su empaque (ya tengo naranja-jengibre 70%, mango-chile 73% y coriandro 70%).');
  texto('9. El paquete de seis sabores (minis de 10 g): ¿qué sabores trae? ¿Las minis también se venden sueltas?');
  texto('10. Las bolsas de 250 g del catálogo (yerbabuena, canela, menta, limoncillo, lima y chile, naranja con jengibre): ¿qué son exactamente — chocolate en trozos, polvo para taza…? ¿Y la cocoa alcalina y los polvos en desarrollo van en la página como "próximamente"?');
  texto('11. Los precios ya son públicos en el catálogo: ¿los mostramos también en la página, o la página solo muestra los productos con botón al catálogo?');
  algoMas('los productos');

  // ——— Recetas ———
  seccion('Recetas');
  texto('12. Pásenme 3 a 5 recetas suyas para arrancar (con foto si hay; también valen por correo).');
  texto('13. ¿Para quién van más: cocina de casa, cafeterías y repostería, o ambas?');
  algoMas('recetas');

  // ——— Para cafeterías y negocios ———
  seccion('Para cafeterías y negocios (sección nueva que propongo)');
  texto('14. Ustedes ya le venden a cafeterías y negocios. ¿Quieren una sección con su propio contacto y las fichas técnicas ahí?');
  texto('15. ¿Manejan pedido mínimo, presentaciones de mayoreo o condiciones especiales que haya que mencionar? (sin publicar números si no quieren)');
  algoMas('la venta a negocios');

  // ——— Fichas técnicas ———
  seccion('Fichas técnicas');
  form.addCheckboxItem()
    .setTitle('16. ¿Qué datos tienen por producto? Marquen lo que sí tienen:')
    .setChoiceValues([
      'Ingredientes',
      'Tabla nutrimental',
      'Alérgenos',
      'Vida de anaquel',
      'Conservación',
      'Presentaciones y empaque',
    ])
    .showOtherOption(true);
  texto('17. ¿Las tienen armadas (PDF o Word)? Si sí, pásenmelas por correo. Si no, necesito esos datos por cada producto. ¿Y van públicas para descargar, o se piden por correo?');
  algoMas('las fichas');

  // ——— Preguntas frecuentes ———
  seccion('Preguntas frecuentes');
  texto('18. ¿Qué les pregunta la gente una y otra vez? Escriban las 5 a 8 de cajón. Si ayuda, algunas típicas: ¿hacen envíos?, ¿dónde los encuentro?, ¿el chocolate aguanta el calor del envío?, ¿qué azúcar usan?, ¿alérgenos?, ¿hacen mayoreo?, ¿regalos y mesas de dulces?');
  algoMas('lo que la gente debe encontrar en preguntas frecuentes');

  // ——— Contacto ———
  seccion('Contacto');
  texto('19. En el catálogo aparece chocolateriadulceolivia@gmail.com. ¿Ese es el correo para la página? ¿"Dulce Olivia" debe aparecer en algún lado, o todo va solo como Maracacao?');
  texto('20. ¿Qué número de WhatsApp muestro y cuáles son los usuarios exactos de sus redes?');
  texto('21. ¿Tienen punto de venta físico u horarios que haya que mostrar?');
  texto('22. Del dominio: ¿cuál les gustaría? (maracacao.mx, maracacao.com.mx, maracacao.com… reviso cuál está libre). Con el dominio puedo crear correos propios, tipo hola@maracacao.mx.');
  algoMas('contacto');

  Logger.log('Para EDITAR (tuyo): ' + form.getEditUrl());
  Logger.log('Para RESPONDER (se manda al cliente): ' + form.getPublishedUrl());
}
