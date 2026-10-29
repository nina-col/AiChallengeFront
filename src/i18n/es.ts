/**
 * Textos en español. Reglas (docs/DESIGN.md): frases cortas, lenguaje llano, sin diagnósticos,
 * sin culpa y en género neutro. El sujeto de la frase es el entorno, no la persona.
 * Los nombres de tareas, estímulos y ajustes vienen del catálogo de la API.
 */

const times = (n: number) => (n === 1 ? 'vez' : 'veces');
/** "A", "A y B", "A, B y C". */
const list = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`;

const es = {
  common: {
    loading: 'Cargando…',
    next: 'Siguiente',
    close: 'Cerrar',
    retry: 'Intentar de nuevo',
    backToToday: 'Volver a Hoy',
    offline: 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.',
    somethingFailed: 'Algo no salió como esperábamos. Tus respuestas siguen aquí; intenta de nuevo.',
    /** Escala de 5 puntos con palabra en cada punto (molestia y esfuerzo). */
    scale: ['Casi nada', 'Poco', 'Algo', 'Bastante', 'Muchísimo'],
  },
  tabs: {
    today: 'Hoy',
    playbook: 'Lo que me sirve',
    settings: 'Ajustes',
  },
  onboarding: {
    mascotIntro: 'Tu espacio también puede adaptarse a ti.',
    welcomeTitle: 'SpaceEase',
    welcomeBody:
      'Descubre qué del lugar te está costando trabajo, prueba un ajuste y quédate con lo que te funciona.',
    start: 'Empezar',
    howTitle: 'Así funciona',
    howSteps: [
      'Cuéntanos tu tarea y cómo te sientes.',
      'Identifica qué te molesta.',
      'Prueba un ajuste y cuéntanos si ayudó.',
    ],
    scanChoice: 'Tú eliges si usas una foto o grabas audio para explorar tu entorno.',
    privacyTitle: 'Tu información',
    privacyBody:
      'No te pedimos diagnóstico, nombre ni correo. Tu empresa no ve nada. Puedes borrar todo cuando quieras desde Ajustes.',
    consent: 'Acepto que SpaceEase guarde mis registros como explica el aviso de privacidad.',
    readNotice: 'Leer el aviso de privacidad',
    continue: 'Continuar',
    placeTitle: '¿Dónde trabajas hoy?',
    placeHint: 'Ponle un nombre que reconozcas. Puedes agregar más lugares después.',
    placeLabel: 'Nombre del lugar',
    placePlaceholder: 'Por ejemplo: Mi escritorio',
    kindLabel: 'Tipo de lugar',
    kinds: { office: 'Oficina', home: 'Casa', other: 'Otro lugar' },
    finish: 'Guardar y empezar',
  },
  today: {
    mascotNote: 'Pequeños cambios, a tu ritmo.',
    promptTitle: '¿Algo te está costando trabajo?',
    promptBody: 'Revisamos juntos tu entorno y te proponemos un solo ajuste para probar.',
    start: 'Revisar mi entorno',
    tryingTitle: 'En prueba',
    tryingFooter: 'Todo está como lo dejaste. Puedes contarlo cuando quieras.',
    tellMe: 'Contar cómo me fue',
    lastHelped: 'Lo último que te ayudó',
    deskTitle: 'Tu escritorio',
    deskEmpty: 'Cada prueba que termines deja aquí un objeto, haya ayudado o no.',
    deskCount: (n: number) => `${n} ${n === 1 ? 'prueba terminada' : 'pruebas terminadas'}`,
    deskTap: 'Toca la escena para darle vida.',
    seeWeek: 'Ver mi semana',
    experienceTitle: '¿Le damos más vida a la app?',
    experienceBody:
      'Con animaciones con detalles, tu escritorio cobra vida y lo que te ayuda se celebra. Los sonidos suaves y la vibración se activan aparte, en Ajustes.',
    experienceYes: 'Activar animaciones con detalles',
    experienceNo: 'Así está bien',
    recapStillTitle: '¿Sigues queriendo el resumen semanal?',
    recapStillBody: 'Hace unas semanas que no lo abres. Está bien de las dos formas.',
    recapKeep: 'Sí, seguir',
    recapStop: 'Ya no, gracias',
  },
  recap: {
    title: 'Tu semana',
    hint: 'Los últimos 7 días, siempre en el mismo orden.',
    notificationTitle: 'Tu semana en SpaceEase',
    notificationBody: 'Tres cosas sobre tu espacio, para cuando quieras verlas.',
    triedLabel: 'Lo que probaste',
    tried: (n: number) => `Probaste ${n} ${n === 1 ? 'ajuste' : 'ajustes'} en los últimos 7 días.`,
    triedNone:
      'Esta semana no hubo pruebas. Puede que hayas descansado o que no lo hayas anotado. Las dos cosas están bien.',
    helpedLabel: 'Lo que ayudó',
    helped: (titles: string[]) => `Te ayudó: ${list(titles.map((t) => t.toLowerCase()))}.`,
    helpedNone: 'Esta semana no hubo algo claro. Eso también es información.',
    helpedNoTrials: 'Cuando pruebes algo, aquí verás si ayudó.',
    bestLabel: 'Lo que más te sirve',
    best: (title: string, helped: number, trials: number) => `${title}: ayudó ${helped} de ${trials} ${times(trials)}.`,
    bestNone: 'Todavía no hay algo que se repita. Con cada prueba se aclara.',
    footer: 'Puedes volver cuando quieras.',
  },
  desk: {
    label: (names: string[]) => (names.length ? `Tu escritorio: ${names.join(', ')}.` : 'Tu escritorio, todavía sin objetos.'),
    newItem: 'Nuevo en tu escritorio',
    afterTrial: 'Cuando nos cuentes cómo te fue, se suma a tu escritorio, haya ayudado o no.',
    learned: 'Ya sabes algo más de este espacio.',
    items: {
      headphones: 'Audífonos',
      speaker: 'Bocina de sonido suave',
      succulent: 'Planta del rincón tranquilo',
      phone: 'Teléfono en silencio',
      sign: 'Señal de concentración',
      blinds: 'Persiana',
      screenDim: 'Pantalla suave',
      lamp: 'Lámpara cálida',
      tray: 'Bandeja ordenada',
      divider: 'Panel divisor',
      fan: 'Ventilador',
      sweater: 'Suéter',
      mug: 'Taza para una pausa',
      frame: 'Foto de casa',
    } as Record<string, string>,
  },
  checkin: {
    reviewStep: (n: number, total: number) => `Revisar entorno · ${n}/${total}`,
    choosePhase: 'Elegir ajuste',
    title: 'Revisar mi entorno',
    step: (n: number, total: number) => `Paso ${n} de ${total}`,
    taskTitle: '¿Qué estás haciendo?',
    moreTasks: 'Ver más tareas',
    feelingTitle: '¿Cómo te sientes con esta tarea?',
    placeTitle: '¿Dónde estás?',
    newPlacePlaceholder: 'Nombre de otro lugar',
    addPlace: 'Agregar',
    discomfortTitle: '¿Cuánto te está molestando el entorno ahora?',
    effortTitle: '¿Cuánto esfuerzo te está costando la tarea?',
    scaleHint: 'No hay respuestas buenas o malas. Sirve para comparar después.',
    domainHint: 'Elige todo lo que notes. Si tienes dudas, elige “No sé”.',
    noneOfThese: 'Nada de esto',
    notSure: 'No sé',
    focusTitle: '¿Qué te afecta más ahora?',
    focusHint: 'Empezamos por una sola cosa. Las demás quedan anotadas.',
    seeSuggestion: 'Ver sugerencia',
  },
  scan: {
    title: '¿Revisamos con foto y sonido?',
    hint: 'Es opcional. A veces ayuda a notar cosas que pasan desapercibidas. Tú decides qué usar.',
    listenConsent: 'Escuchar 10 segundos',
    listenDetail: 'El sonido se analiza en este teléfono y se borra al terminar. Nunca se envía ni se guarda.',
    photoConsent: 'Analizar una foto con IA',
    photoDetail:
      'Antes de enviarla, el teléfono pixela caras y siluetas. La foto va a Claude (Anthropic) solo para buscar posibles fuentes de molestia y no se guarda.',
    photoUnavailable: 'Disponible en la app instalada desde TestFlight.',
    start: 'Empezar',
    skip: 'Solo con preguntas',
    listenTitle: 'Escuchemos 10 segundos',
    listenHint: 'Deja el teléfono quieto donde trabajas. No hace falta hablar.',
    listenStart: 'Empezar a escuchar',
    listening: (seconds: number) => `Escuchando… quedan ${seconds} s`,
    listenStop: 'Detener',
    listenDenied: 'Sin permiso del micrófono no podemos escuchar. Puedes intentarlo otra vez o seguir sin sonido.',
    listenBlocked:
      'iOS ya no vuelve a preguntar por el micrófono. Puedes activarlo en Configuración → SpaceEase → Micrófono, o seguir sin sonido.',
    openSettings: 'Abrir Configuración',
    continueWithout: 'Seguir sin esto',
    photoTitle: 'Toma una foto de tu lugar',
    photoHint: 'Apunta a lo que ves mientras trabajas. Si sale alguien, el teléfono lo pixela antes de enviar.',
    takePhoto: 'Tomar foto',
    photoDenied:
      'Sin permiso de la cámara no podemos tomar la foto. Puedes activarlo en Configuración → SpaceEase → Cámara, o seguir sin foto.',
    previewTitle: 'Así se enviará la foto',
    previewPeople: (n: number) =>
      n === 0 ? 'No encontramos personas en la foto.' : `Se ocultaron ${n} ${n === 1 ? 'persona' : 'personas'}.`,
    usePhoto: 'Usar esta foto',
    retake: 'Tomar otra',
    analyzing: 'Analizando la foto… tarda unos segundos.',
    scanFailed: 'No pudimos analizar la foto esta vez. Sigamos con las preguntas.',
    findingsTitle: 'Esto es lo que notamos',
    findingsHint: 'Son posibilidades, no certezas. Dinos si te afectan.',
    noFindings: 'No encontramos nada claro. Sigamos con unas preguntas.',
    markerLabel: (n: number, text: string) => `Marca ${n}: ${text}`,
    fromSound: 'Del sonido',
    audioQuestions: {
      voices: 'Parece que hay voces o conversaciones cerca. ¿Te distraen?',
      noise_constant: 'Parece que hay un ruido de fondo constante. ¿Te molesta?',
      noise_sudden: 'Hubo ruidos repentinos. ¿Te molestan?',
    } as Record<string, string>,
  },
  proposal: {
    selfKind: 'Lo puedes hacer tú',
    askKind: 'Para pedir a tu empresa',
    baselineKind: 'Comparación',
    whyLabel: 'Por qué puede ayudar',
    firstTry: (stimulus: string) =>
      `Es una idea para empezar con: ${stimulus.toLowerCase()}. Todavía no sabemos si a ti te funciona.`,
    exploring: 'Probemos algo nuevo para aprender qué más te sirve.',
    comparison: 'De vez en cuando comparamos con un momento sin cambios.',
    triedHere: (helped: number, trials: number) =>
      `Aquí, en esta tarea, ayudó ${helped} de ${trials} ${times(trials)}.`,
    triedElsewhere: (helped: number, trials: number) =>
      `En otras tareas o lugares ayudó ${helped} de ${trials} ${times(trials)}.`,
    accept: 'Lo voy a probar',
    otherIdea: 'Dame otra idea',
    cannotHere: 'No puedo hacerlo aquí',
    baselineAccept: 'De acuerdo',
    baselineDecline: 'Prefiero probar un ajuste',
    prepareRequest: 'Preparar la solicitud',
    noneTitle: 'No hay algo claro por ahora',
    noneBody:
      'A veces no es fácil saber qué molesta, y está bien. Guardamos tu registro. Puedes volver a revisar más tarde.',
    exhaustedTitle: 'Ya probamos las ideas que tenemos para esto',
    exhaustedBody: 'En este lugar no quedan sugerencias nuevas. Lo que ya te funcionó sigue en «Lo que me sirve».',
  },
  reminder: {
    title: '¿Cuándo te pregunto cómo te fue?',
    hint: 'Te mandamos un solo aviso, sin sonido. Puedes contestar antes o después.',
    in25: 'En 25 minutos',
    in50: 'En 50 minutos',
    myself: 'Yo vuelvo cuando termine',
    // Lo que se ve con el teléfono bloqueado no dice qué ajuste ni qué molesta.
    notificationTitle: '¿Cómo te fue?',
    notificationBody: 'Cuando quieras, cuéntanos cómo te fue con la prueba.',
    plan: (task: string, adjustment: string) =>
      `Tu plan: la próxima vez que toque «${task}» aquí, ${adjustment.toLowerCase()}.`,
    doneTitle: 'Listo',
    doneBody: 'Trabaja a tu ritmo. Cuando termines, cuéntanos cómo te fue desde Hoy.',
  },
  checkout: {
    title: 'Cómo te fue',
    discomfortTitle: '¿Cuánto te molestó el entorno durante este rato?',
    effortTitle: '¿Cuánto esfuerzo te costó la tarea?',
    helpedTitle: '¿Crees que el ajuste ayudó?',
    yes: 'Sí',
    no: 'No',
    unsure: 'No sé',
    helpedResult: 'Parece que te ayudó',
    notHelpedResult: 'Esta vez no ayudó',
    unclearResult: 'Todavía no está claro',
    comparisonResult: 'Gracias por comparar',
    change: (before: number, after: number) => `La molestia del entorno pasó de ${before} a ${after} (de 5).`,
    helpedBody: 'Mejoró más de lo que suele mejorar para ti.',
    savedTo: (task: string, place?: string) =>
      `Lo guardamos en «Lo que me sirve» para ${task.toLowerCase()}${place ? ` en ${place}` : ''}.`,
    evidence: (helped: number, trials: number) =>
      trials >= 3
        ? `Lo has probado ${trials} veces aquí; ayudó en ${helped}.${trials < 5 ? ' Todavía no es seguro.' : ''}`
        : null,
    notHelpedBody: 'Eso también es información útil. La próxima vez te propondremos otra cosa.',
    unclearBody: 'Si lo vuelves a probar, lo sabremos mejor.',
    unclearBetterBody: 'Mejoró, pero no más de lo habitual para ti. Si lo vuelves a probar, lo sabremos mejor.',
    comparisonBody:
      'Saber cómo cambia tu día sin ajustes nos ayuda a juzgar mejor los que pruebes después.',
    recapOfferTitle: '¿Quieres un resumen cada semana?',
    recapOfferBody: 'Tres cosas sobre tu espacio, el día y a la hora que elijas. Sin sonido.',
    recapOfferYes: 'Elegir día y hora',
    recapOfferNo: 'No, gracias',
  },
  playbook: {
    emptyTitle: 'Aquí aparecerá lo que te funcione',
    emptyBody: 'Cada vez que un ajuste te ayude, lo guardamos con la tarea y el lugar donde funcionó.',
    evidence: (helped: number, trials: number) => {
      if (trials >= 5 && helped / trials >= 2 / 3) return `Te suele ayudar: ${helped} de ${trials} veces`;
      if (trials >= 3) return `Ayudó ${helped} de ${trials} veces. Todavía no es seguro.`;
      return `Ayudó ${helped} de ${trials} ${times(trials)}`;
    },
    forStimulus: (stimulus: string) => `Para: ${stimulus.toLowerCase()}`,
    makeItPermanent: 'Pedirlo de forma permanente',
    anyPlace: 'Sin lugar',
  },
  request: {
    restoreDraft: 'Recuperar mi texto editado',
    title: 'Solicitud de ajuste',
    hint: 'Revisa y cambia lo que quieras. No incluye ningún diagnóstico. Tú decides si la envías y a quién.',
    includeData: 'Incluir lo que he registrado',
    share: 'Compartir o copiar',
    effects: {
      focus: 'concentrarme',
      drained: 'mantener mi energía durante el día',
      discomfort: 'trabajar con comodidad',
      overload: 'evitar saturarme',
      other: 'trabajar como necesito',
    } as Record<string, string>,
    letter: (p: {
      task: string;
      place?: string;
      stimulus: string;
      effect: string;
      adjustment: string;
      alternatives: string[];
      reviewDate: string;
      data?: string;
    }) =>
      [
        'Hola:',
        `Para hacer mejor mi trabajo de ${p.task.toLowerCase()}, quiero proponer un ajuste${p.place ? ` en ${p.place}` : ''}.`,
        `Lo que más me afecta es: ${p.stimulus.toLowerCase()}. Esto me dificulta ${p.effect}.`,
        `Propongo: ${p.adjustment.toLowerCase()}.${p.alternatives.length ? ` También podría funcionar: ${p.alternatives.map((a) => a.toLowerCase()).join(' o ')}.` : ''}`,
        p.data,
        `¿Podemos probarlo dos semanas y revisarlo juntos el ${p.reviewDate}?`,
        'Gracias.',
      ]
        .filter(Boolean)
        .join('\n\n'),
    dataLine: (adjustment: string, helped: number, trials: number) =>
      `He registrado cómo trabajo: cuando ${adjustment.toLowerCase()}, me ayudó en ${helped} de ${trials} ${times(trials)}.`,
  },
  settings: {
    preferences: 'Preferencias',
    language: 'Idioma',
    languageSystem: 'Como el teléfono',
    motion: 'Movimiento',
    motionSystem: 'Como el teléfono',
    motionReduced: 'Siempre reducido',
    haptics: 'Vibración al confirmar',
    softContrast: 'Contraste suave',
    experience: 'Cómo se ve y suena',
    experienceFooter: 'Con «Reducir movimiento» de iOS todo queda quieto, aunque las animaciones estén activadas.',
    details: 'Animaciones con detalles',
    detailsHint: 'Tu escritorio cobra vida y lo que te ayuda se celebra.',
    sounds: 'Sonidos suaves',
    soundsHint: 'Tonos cortos y bajos al avanzar y al terminar. Callan con el modo silencio.',
    volume: 'Volumen',
    volumeLow: 'Bajo',
    volumeMedium: 'Medio',
    testSound: 'Probar sonido',
    previewHint: 'Toca la escena para ver cómo se mueve.',
    showDesk: 'Mostrar Tu escritorio en Hoy',
    showDeskHint: 'Los objetos de lo que te ayudó. Si lo ocultas, no se pierde nada.',
    recap: 'Resumen semanal',
    recapFooter: 'Un aviso sin sonido el día y a la hora que elijas, con tres cosas, siempre en el mismo orden.',
    recapTime: 'Hora',
    recapOff: 'No, gracias',
    recapDays: { mon: 'Los lunes', wed: 'Los miércoles', fri: 'Los viernes', sun: 'Los domingos' },
    recapDenied:
      'Sin permiso de avisos no podemos mandarlo. Puedes activarlo en Configuración → SpaceEase → Notificaciones.',
    scanSection: 'Foto y sonido',
    scanSectionFooter: 'Puedes cambiar esto cuando quieras. Lo que ya se analizó no se guardó.',
    places: 'Mis lugares',
    removePlace: 'Quitar',
    addPlace: 'Agregar',
    newPlacePlaceholder: 'Nombre del lugar',
    privacy: 'Privacidad',
    privacyBody:
      'Guardamos tus registros (tarea, cómo te sentías, lo que notaste, el ajuste y si ayudó) con una llave anónima de este teléfono. No guardamos diagnósticos ni datos de contacto, y tu empresa no tiene acceso.',
    readPrivacy: 'Leer el aviso de privacidad',
    deleteAll: 'Borrar todos mis datos',
    deleteConfirmTitle: '¿Borrar todos tus datos?',
    deleteConfirmBody:
      'Se borran tus lugares, tus registros y lo que te sirve, del servidor y de este teléfono. No se puede deshacer.',
    deleteConfirm: 'Borrar todo',
    cancel: 'Cancelar',
    about: 'Acerca de',
    version: (app: string, apiVersion?: string) => `Versión ${app}${apiVersion ? ` · API ${apiVersion}` : ''}`,
    serverOk: 'Servidor conectado',
    serverDown: 'Sin conexión con el servidor',
  },
};

export type Strings = typeof es;
export default es;
