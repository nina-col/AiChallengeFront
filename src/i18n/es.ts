/**
 * Textos en español. Reglas (docs/DESIGN.md): frases cortas, lenguaje llano, sin diagnósticos,
 * sin culpa y en género neutro. El sujeto de la frase es el entorno, no la persona.
 * Los nombres de tareas, estímulos y ajustes vienen del catálogo de la API.
 */

const times = (n: number) => (n === 1 ? 'vez' : 'veces');

const es = {
  common: {
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
    welcomeTitle: 'SpaceEase',
    welcomeBody:
      'Descubre qué del lugar te está costando trabajo, prueba un ajuste y quédate con lo que te funciona.',
    start: 'Empezar',
    howTitle: 'Así funciona',
    howSteps: [
      'Nos cuentas qué tarea haces y cómo te sientes.',
      'Revisamos juntos el sonido, la luz y lo que ves.',
      'Te proponemos un solo ajuste y después nos dices si ayudó.',
    ],
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
    promptTitle: '¿Algo te está costando trabajo?',
    promptBody: 'Revisamos juntos tu entorno y te proponemos un solo ajuste para probar.',
    start: 'Revisar mi entorno',
    tryingTitle: 'En prueba',
    tellMe: 'Contar cómo me fue',
    lastHelped: 'Lo último que te ayudó',
  },
  checkin: {
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
    notificationTitle: '¿Cómo te fue?',
    notificationBody: (adjustment: string) => `Cuéntanos cómo te fue con “${adjustment}”.`,
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
