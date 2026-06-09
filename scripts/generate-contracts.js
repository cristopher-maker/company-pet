const {
  Document, Packer, Paragraph, TextRun, AlignmentType,
  LevelFormat, BorderStyle, Table, TableRow, TableCell, WidthType,
  Header, Footer, TabStopType, TabStopPosition, SimpleField
} = require('docx');
const fs = require('fs');
const path = require('path');

const GRAY = "595959";
const DARK = "1A1A2E";

function makeDoc(config) {
  // Desestructuramos los datos desde la configuración
  const { ACCENT, headerTitle, titleSub, productName, productShort, prestador, cliente } = config;

  function h(text) {
    return new Paragraph({
      spacing: { before: 320, after: 120 },
      keepWithNext: true,
      children: [new TextRun({ text, bold: true, size: 22, font: "Arial", color: ACCENT, allCaps: true })]
    });
  }

  function body(text, opts = {}) {
    return new Paragraph({
      alignment: opts.justify ? AlignmentType.JUSTIFIED : AlignmentType.LEFT,
      spacing: { before: 80, after: 80 },
      children: [new TextRun({ text, size: 20, font: "Arial", color: DARK, bold: opts.bold || false })]
    });
  }

  function listItem(text) {
    return new Paragraph({
      numbering: { reference: "numbers", level: 0 },
      spacing: { before: 60, after: 60 },
      children: [new TextRun({ text, size: 20, font: "Arial", color: DARK })]
    });
  }

  function spacer() {
    return new Paragraph({ spacing: { before: 60, after: 60 }, children: [new TextRun("")] });
  }

  function signLine(label, fields) {
    const lines = [
      new Paragraph({
        spacing: { before: 280, after: 60 },
        children: [new TextRun({ text: "_".repeat(52), size: 20, font: "Arial", color: GRAY })]
      }),
      new Paragraph({
        spacing: { before: 40, after: 40 },
        children: [new TextRun({ text: label, bold: true, size: 20, font: "Arial", color: DARK })]
      }),
    ];
    for (const f of fields) {
      lines.push(new Paragraph({
        spacing: { before: 20, after: 20 },
        children: [new TextRun({ text: f, size: 20, font: "Arial", color: GRAY })]
      }));
    }
    return lines;
  }

  function makeCell(text, bold = false, bgColor = null) {
    return new TableCell({
      children: [new Paragraph({
        children: [new TextRun({ text, size: 18, font: "Arial", color: DARK, bold })]
      })],
      shading: bgColor ? { fill: bgColor } : undefined,
      margins: { top: 120, bottom: 120, left: 120, right: 120 }
    });
  }

  return new Document({
    numbering: {
      config: [{
        reference: "numbers",
        levels: [{
          level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } }
        }]
      }]
    },
    styles: { default: { document: { run: { font: "Arial", size: 20 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } },
            spacing: { after: 160 },
            children: [new TextRun({ text: headerTitle, size: 16, font: "Arial", color: GRAY, bold: true })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            border: { top: { style: BorderStyle.SINGLE, size: 6, color: ACCENT, space: 1 } },
            spacing: { before: 120 },
            tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }],
            children: [
              new TextRun({ text: `${prestador.razonSocial}  \u2014  Confidencial`, size: 16, font: "Arial", color: GRAY }),
              new TextRun({ text: "\tPágina ", size: 16, font: "Arial", color: GRAY }),
              new SimpleField("PAGE"),
            ]
          })]
        })
      },
      children: [
        // Título
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 480, after: 120 },
          children: [new TextRun({ text: "CONTRATO DE PRESTACIÓN DE SERVICIOS", bold: true, size: 32, font: "Arial", color: DARK })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 60 },
          children: [new TextRun({ text: titleSub, size: 24, font: "Arial", color: ACCENT, bold: true })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 60, after: 480 },
          children: [new TextRun({ text: "[Ciudad], [Fecha]", size: 20, font: "Arial", color: GRAY, italics: true })]
        }),
 
        // Partes
        h("PARTES"),
        body("En [ciudad], a [fecha], comparecen:", { justify: true }),
        spacer(),
        body(`Por una parte, ${prestador.razonSocial}, rol único tributario número ${prestador.rut}, representada por don ${prestador.representante}, cédula de identidad número ${prestador.ci}, ambos domiciliados para estos efectos en ${prestador.domicilio}, correo electrónico [${prestador.correo}], en adelante también el “Prestador” o “${prestador.nombreCorto}”.`, { justify: true }),
        spacer(),
        body(`Por la otra, ${cliente.razonSocial}, rol único tributario número ${cliente.rut}, representada legalmente por don ${cliente.representante}, de nacionalidad ${cliente.nacionalidad}, ${cliente.estadoCivil}, de profesión ${cliente.profesion}, cédula de identidad número ${cliente.ci}, ambos domiciliados para estos efectos en ${cliente.domicilio}, correo electrónico [${cliente.correo}], en adelante el “Cliente”.`, { justify: true }),
        spacer(),
        body("Las partes acuerdan celebrar el presente contrato sujeto a las siguientes cláusulas:", { justify: true }),
 
        h("PRIMERA: OBJETO"),
        body(`El Prestador se obliga a prestar al Cliente servicios asociados a la implementación, habilitación, acompañamiento y pilotaje de la solución denominada ${productName}, con el objeto de evaluar su uso, funcionamiento, adopción y beneficios durante un período piloto.`, { justify: true }),
        spacer(),
        body("El presente contrato tiene naturaleza de prestación de servicios y no genera vínculo laboral, sociedad, agencia, mandato comercial permanente ni relación de subordinación o dependencia entre las partes.", { justify: true }),
 
        h("SEGUNDA: ALCANCE DE LOS SERVICIOS"),
        body(`Durante la vigencia del contrato, ${prestador.nombreCorto} realizará, según corresponda:`, { justify: true }),
        listItem(`Habilitación inicial del piloto de ${productShort}.`),
        listItem("Configuración básica de usuarios, accesos, módulos o funcionalidades acordadas."),
        listItem("Capacitación o inducción inicial al equipo designado por el Cliente."),
        listItem("Soporte funcional durante el período piloto, conforme a los canales y horarios definidos en el Anexo A."),
        listItem("Acompañamiento en la evaluación del uso de la plataforma."),
        listItem("Reuniones de seguimiento, de acuerdo con la periodicidad que acuerden las partes."),
        listItem("Entrega de conclusiones, recomendaciones o reporte final del piloto, si fuere acordado."),
        spacer(),
        body("Cualquier desarrollo adicional, integración especial, personalización avanzada, soporte presencial, migración de datos o servicio no indicado expresamente en este contrato deberá pactarse por escrito entre las partes.", { justify: true }),
 
        h("TERCERA: DURACIÓN"),
        body("El presente contrato tendrá una duración de 3 meses, contados desde el día [fecha de inicio] hasta el día [fecha de término], sin necesidad de aviso adicional.", { justify: true }),
        spacer(),
        body("Las partes podrán renovar, extender o transformar el piloto en un servicio comercial permanente mediante acuerdo escrito firmado antes del término de la vigencia.", { justify: true }),
 
        h("CUARTA: PRECIO Y FORMA DE PAGO"),
        body(`Por los servicios objeto de este contrato, el Cliente pagará a ${prestador.nombreCorto} la suma de $[●] + IVA, o la suma que corresponda según la propuesta comercial aceptada por las partes.`, { justify: true }),
        spacer(),
        body("El pago se realizará de la siguiente forma: [mensual / único pago / contra factura / otra modalidad].", { justify: true }),
        spacer(),
        body(`${prestador.nombreCorto} emitirá la documentación tributaria correspondiente conforme a la normativa vigente.`, { justify: true }),
 
        h("QUINTA: OBLIGACIONES DEL PRESTADOR"),
        body(`${prestador.nombreCorto} se obliga a:`, { justify: true }),
        listItem("Prestar los servicios con diligencia y conforme al alcance acordado."),
        listItem("Disponer los medios razonables para la ejecución del piloto."),
        listItem("Informar al Cliente sobre incidencias relevantes que puedan afectar la prestación del servicio."),
        listItem("Mantener reserva respecto de la información confidencial del Cliente."),
        listItem("Entregar soporte dentro de los canales y horarios acordados por las partes."),
 
        h("SEXTA: OBLIGACIONES DEL CLIENTE"),
        body("El Cliente se obliga a:", { justify: true }),
        listItem("Entregar oportunamente la información necesaria para ejecutar el piloto."),
        listItem("Designar una contraparte responsable para la coordinación del proyecto."),
        listItem(`Usar la plataforma conforme a las instrucciones entregadas por ${prestador.nombreCorto}.`),
        listItem(`No copiar, modificar, sublicenciar, revender ni explotar comercialmente ${productShort} sin autorización previa y escrita.`),
        listItem("Pagar el precio pactado en tiempo y forma."),
        listItem("Informar oportunamente cualquier incidencia, error o dificultad detectada durante el piloto."),
 
        h("SÉPTIMA: PROPIEDAD INTELECTUAL"),
        body(`La plataforma ${productName}, incluyendo su software, diseño, funcionalidades, documentación, marcas, contenidos, metodologías, procesos, know-how y demás elementos asociados, es y seguirá siendo de propiedad exclusiva de ${prestador.nombreCorto} o de sus respectivos titulares.`, { justify: true }),
        spacer(),
        body(`El Cliente recibe únicamente una autorización limitada, temporal, no exclusiva, no transferible y revocable para usar la plataforma durante el período piloto, exclusivamente para los fines establecidos en este contrato.`, { justify: true }),
 
        h("OCTAVA: CONFIDENCIALIDAD"),
        body("Toda información técnica, comercial, financiera, operacional, estratégica o de cualquier otra naturaleza que una parte entregue a la otra con ocasión de este contrato será considerada confidencial, salvo que sea de público conocimiento o que la parte receptora pueda demostrar haberla conocido legítimamente con anterioridad.", { justify: true }),
        spacer(),
        body("Las partes se obligan a no divulgar ni utilizar dicha información para fines distintos del cumplimiento del presente contrato.", { justify: true }),
        spacer(),
        body("Esta obligación se mantendrá vigente por [2 / 3 / 5] años después del término del contrato.", { justify: true }),
 
        h("NOVENA: DATOS E INFORMACIÓN"),
        body("En caso de que el Cliente entregue datos de usuarios, trabajadores, clientes, mascotas, beneficiarios u otra información similar, el Cliente declara contar con las autorizaciones necesarias para su tratamiento y uso dentro del marco del presente contrato.", { justify: true }),
        spacer(),
        body(`${prestador.nombreCorto} tratará dicha información únicamente para ejecutar el piloto, prestar soporte, mejorar la operación del servicio y cumplir las obligaciones pactadas, adoptando medidas razonables de seguridad.`, { justify: true }),
 
        h("DÉCIMA: EXCLUSIÓN DE GARANTÍAS Y LIMITACIÓN DE RESPONSABILIDAD"),
        body(`El piloto tiene por finalidad evaluar el funcionamiento y conveniencia de la plataforma en un entorno real o controlado. La plataforma se entrega en su estado actual (“as is”), sin garantía de disponibilidad continua, ausencia de errores ni idoneidad para un propósito específico, salvo que ello haya sido expresamente pactado.`, { justify: true }),
        spacer(),
        body(`${prestador.nombreCorto} no garantiza resultados comerciales, operacionales, financieros, de adopción o de desempeño específicos. Su responsabilidad se limitará a los daños directos efectivamente acreditados y no excederá el monto total pagado por el Cliente durante la vigencia del presente contrato.`, { justify: true }),
 
        h("DÉCIMA PRIMERA: TÉRMINO ANTICIPADO"),
        body("Cualquiera de las partes podrá poner término anticipado al contrato mediante aviso escrito enviado a la otra parte con al menos 15 días corridos de anticipación.", { justify: true }),
        spacer(),
        body("Asimismo, cualquiera de las partes podrá terminar el contrato de inmediato en caso de incumplimiento grave, siempre que no sea subsanado dentro de un plazo de 5 días hábiles desde la notificación escrita correspondiente.", { justify: true }),
        spacer(),
        body("El término anticipado no liberará al Cliente del pago de los servicios efectivamente prestados hasta la fecha de término.", { justify: true }),
 
        h("DÉCIMA SEGUNDA: NO EXCLUSIVIDAD"),
        body(`El presente contrato no otorga exclusividad al Cliente ni impide que ${prestador.nombreCorto} preste servicios, desarrolle pilotos o comercialice ${productShort} u otras soluciones a terceros.`, { justify: true }),
 
        h("DÉCIMA TERCERA: COMUNICACIONES"),
        body("Toda comunicación relacionada con este contrato deberá realizarse por escrito a los correos electrónicos indicados:", { justify: true }),
        spacer(),
        body(`${prestador.razonSocial}: [${prestador.correo}]`),
        body(`Cliente: [${cliente.correo}]`),
 
        h("DÉCIMA CUARTA: LEY APLICABLE Y JURISDICCIÓN"),
        body("El presente contrato se regirá por las leyes de la República de Chile. Para todos los efectos derivados de este contrato, las partes fijan su domicilio en la ciudad de [ciudad] y se someten a la competencia de sus tribunales ordinarios de justicia.", { justify: true }),
 
        h("DÉCIMA QUINTA: FUERZA MAYOR"),
        body("Ninguna de las partes será responsable por el incumplimiento o retraso cuando ello se deba a circunstancias de fuerza mayor o caso fortuito conforme a la legislación chilena, incluyendo desastres naturales, fallas generalizadas de telecomunicaciones, actos de autoridad, conflictos laborales, interrupciones de servicios de terceros o cualquier evento fuera del control razonable de las partes.", { justify: true }),
        spacer(),
        body("La parte afectada deberá informar a la otra tan pronto como sea razonablemente posible.", { justify: true }),
 
        h("DÉCIMA SEXTA: SUSPENSIÓN POR INCUMPLIMIENTO DE PAGO"),
        body(`En caso de mora o retraso en el pago de cualquier suma adeudada, ${prestador.nombreCorto} podrá suspender total o parcialmente el acceso a ${productShort} hasta la regularización de los pagos pendientes, sin que ello constituya incumplimiento contractual por parte del Prestador.`, { justify: true }),
 
        h("DÉCIMA SÉPTIMA: RETROALIMENTACIÓN Y MEJORA DEL SERVICIO"),
        body(`El Cliente acepta que las observaciones, comentarios, sugerencias, recomendaciones y resultados obtenidos durante el período piloto podrán ser utilizados por ${prestador.nombreCorto} para fines de mejora, desarrollo y optimización de ${productShort}, siempre que dicha información sea tratada de forma agregada o anonimizada y no revele información confidencial del Cliente.`, { justify: true }),
 
        h("DÉCIMA OCTAVA: REUNIÓN DE CIERRE"),
        body("Al término del período piloto, las partes podrán realizar una reunión de cierre para revisar los resultados obtenidos, evaluar el funcionamiento de la plataforma y determinar la conveniencia de continuar mediante una contratación comercial posterior.", { justify: true }),
        spacer(),
        body(`La finalización del piloto no obliga al Cliente a contratar servicios adicionales ni a ${prestador.nombreCorto} a otorgar condiciones comerciales distintas de las que acuerden expresamente las partes.`, { justify: true }),
 
        h("DÉCIMA NOVENA: INTEGRIDAD DEL CONTRATO"),
        body(`El presente contrato constituye el acuerdo íntegro entre las partes respecto de su objeto y reemplaza cualquier conversación, propuesta o acuerdo previo, verbal o escrito, relacionado con el piloto de ${productShort}.`, { justify: true }),
 
        spacer(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 80 },
          children: [new TextRun({ text: "En señal de aceptación, las partes firman el presente contrato en dos ejemplares del mismo tenor y fecha.", size: 20, font: "Arial", color: GRAY, italics: true })]
        }),
        spacer(),
 
        // Bloque de Firma Dinámico del Prestador
        ...signLine(prestador.razonSocial, [
          `RUT: ${prestador.rut}`,
          `Representante legal: ${prestador.representante}`,
          `C.I.: ${prestador.ci}`,
          `Domicilio: ${prestador.domicilio}`,
          `Correo: ${prestador.correo}`,
        ]),
        spacer(),
        // Bloque de Firma del Cliente
        ...signLine(cliente.razonSocial, [
          `RUT: ${cliente.rut}`,
          `Representante legal: ${cliente.representante}`,
          `C.I.: ${cliente.ci}`,
          `Domicilio: ${cliente.domicilio}`,
          `Correo: ${cliente.correo}`,
        ]),
        
        // --- ANEXO A (Regulación del Soporte Técnico) ---
        new Paragraph({ pageBreakBefore: true }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 120 },
          children: [new TextRun({ text: "ANEXO A: CANALES Y HORARIOS DE SOPORTE TÉCNICO", bold: true, size: 24, font: "Arial", color: ACCENT })]
        }),
        body(`El presente Anexo regula las condiciones de asistencia técnico-funcional provistas por ${prestador.nombreCorto} para la plataforma ${productShort} durante el período piloto:`, { justify: true }),
        spacer(),
        
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: [
            new TableRow({
              children: [
                makeCell("Concepto", true, "F2F2F2"),
                makeCell("Detalle y Condición", true, "F2F2F2")
              ]
            }),
            new TableRow({
              children: [
                makeCell("Canales Habilitados", true),
                makeCell(`Soporte vía correo electrónico a [${prestador.correo}] y chat de mensajería al número corporativo coordinado con la contraparte del Cliente.`)
              ]
            }),
            new TableRow({
              children: [
                makeCell("Horario de Atención", true),
                makeCell("Lunes a viernes de 09:00 a 18:00 horas (Hora de Chile Continente). Se excluyen días sábados, domingos y festivos en Chile.")
              ]
            }),
            new TableRow({
              children: [
                makeCell("Tiempos de Respuesta", true),
                makeCell("Máximo 24 horas hábiles desde la recepción formal del requerimiento para entregar el acuse de recibo o estado técnico inicial.")
              ]
            }),
            new TableRow({
              children: [
                makeCell("Exclusiones", true),
                makeCell("El soporte no incluye reparación de hardware, configuraciones de conectividad interna del Cliente, ni desarrollos de software a medida ajenos al alcance original del piloto.")
              ]
            })
          ]
        })
      ]
    }]
  });
}

async function main() {
  const outputDir = path.join(__dirname, "../outputs");
  if (!fs.existsSync(outputDir)){
      fs.mkdirSync(outputDir, { recursive: true });
  }

  // Nosotros somos los prestadores de servicios
  const prestadorConfig = {
    razonSocial: "Comercial Ovni SpA",
    rut: "77.765.200-1",
    representante: "[Nombre Representante Prestador]",
    ci: "[C.I. Representante Prestador]",
    domicilio: "[Domicilio Prestador]",
    correo: "contacto@comercialovni.cl",
    nombreCorto: "Comercial Ovni"
  };

  // El cliente es FUJICORP S.A.
  const clienteConfig = {
    razonSocial: "FUJICORP S.A.",
    rut: "78.923.020-K",
    representante: "IVÁN ALBERTO MAHANA GORAB",
    nacionalidad: "chilena",
    estadoCivil: "casado",
    profesion: "Contador Auditor",
    ci: "9.031.323-1",
    domicilio: "Avenida Kennedy número 5757, oficina 1601, comuna de Las Condes",
    correo: "contacto@fujicorp.cl"
  };

  const pet = makeDoc({
    ACCENT: "2E7D32", // Verde
    headerTitle: "CONTRATO DE PRESTACIÓN DE SERVICIOS — PILOTO COMPANY PET",
    titleSub: "Piloto de Plataforma Company Pet",
    productName: "Company Pet",
    productShort: "Company Pet",
    prestador: prestadorConfig,
    cliente: clienteConfig
  });

  const care = makeDoc({
    ACCENT: "1565C0", // Azul corporativo
    headerTitle: "CONTRATO DE PRESTACIÓN DE SERVICIOS — PILOTO COMPANY CARE",
    titleSub: "Piloto de Plataforma Company Care",
    productName: "Company Care",
    productShort: "Company Care",
    prestador: prestadorConfig,
    cliente: clienteConfig
  });

  console.log("Generando buffers de Word...");
  const [petBuf, careBuf] = await Promise.all([Packer.toBuffer(pet), Packer.toBuffer(care)]);
  
  const petPath = path.join(outputDir, "Contrato_Piloto_CompanyPet.docx");
  const carePath = path.join(outputDir, "Contrato_Piloto_CompanyCare.docx");
  
  fs.writeFileSync(petPath, petBuf);
  fs.writeFileSync(carePath, careBuf);
  
  console.log(`\n¡Archivos .docx generados con éxito!`);
  console.log(`- Contrato Company Pet: ${petPath}`);
  console.log(`- Contrato Company Care: ${carePath}`);
}

main().catch(err => console.error(err));
