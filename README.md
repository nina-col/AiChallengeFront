# Space Ease — Frontend móvil

Space Ease ayuda a personas neurodivergentes a reconocer molestias sensoriales, necesidades físicas y dificultades para concentrarse, comenzar u organizar una actividad. Propone ajustes pequeños que la persona puede probar y evaluar. Es una herramienta de acompañamiento, no de diagnóstico.

## Funcionalidad

- Check-in adaptativo: elegir trabajar aspectos sensoriales, internos o recibir orientación si no se está seguro; preguntar solo por las áreas seleccionadas.
- Registrar lugares, probar ajustes y consultar resultados y estrategias que han ayudado.
- Exploración opcional del entorno mediante foto o análisis local de sonido. La foto se envía a Claude a través de la API; la llave del proveedor permanece en el backend.
- Pausas de respiración y anclaje al presente, narración opcional y jardín con tiempo limitado; también actividades de colorear y decoración.
- Personalizar tema, paleta, fuente, tamaño de texto y espaciado; controlar sonido, vibración, movimiento y elementos decorativos.
- Interfaz en español e inglés.

## Repositorios y TestFlight

Trabajamos en dos repositorios: `AiChallengeFront` para la aplicación y `AiChallengeBack` para la API. Integramos ambos en el [monorepo AiChallenge](https://github.com/Quique2/AiChallenge.git) para coordinar la versión completa y preparar la compilación y distribución por TestFlight. Allí el front corresponde a `apps/mobile` y el back a `apps/api`.

TestFlight distribuye la aplicación iOS; la API se despliega por separado en Railway. Unificar el código permite coordinar los cambios de ambos servicios, pero no empaqueta el servidor dentro de la aplicación.

Los commits `sync monorepo@…` identifican sincronizaciones con el monorepo. Antes de trabajar, actualizar la rama con `git pull`; usar commits descriptivos y coordinar su integración con el equipo. Conservar la autoría y evitar force-push. Las publicaciones de TestFlight se coordinan desde el monorepo.

## Stack y estructura

Expo SDK 58, React Native, React, TypeScript y Expo Router; TanStack Query para consultas remotas, AsyncStorage para preferencias, SecureStore para la llave de sesión y Skia para escenas y actividades gráficas. Las versiones exactas están en `package.json` y `package-lock.json`.

| Ruta | Responsabilidad |
|---|---|
| `src/app/` | Pantallas y navegación |
| `src/components/` | Controles reutilizables y escenas |
| `src/lib/` | API, sesión, preferencias y lógica de actividades |
| `src/hooks/` | Tema, tipografía y sesiones |
| `src/i18n/` | Textos en español e inglés |
| `assets/` | Imágenes, fuentes y licencias |
| `scripts/` | Verificaciones de apariencia y bienestar |

## Instalación y ejecución

Requisitos: Node.js LTS compatible con Expo SDK 58, npm y un teléfono con Expo Go compatible o una compilación de desarrollo. Usar la misma versión de Node que el equipo de integración. Docker y Rust solo son necesarios si también se ejecuta el backend localmente.

Desde la raíz de este repositorio:

```bash
npm ci
npm start
```

Escanear el QR con la cámara de iOS o Expo Go en Android. El teléfono y la computadora deben poder comunicarse por la red local. La compatibilidad de módulos nativos depende del cliente instalado; para comprobar la experiencia de entrega, usar la compilación iOS de TestFlight.

También se puede abrir la interfaz web con `npm run web`. Cámara, audio, almacenamiento seguro y comportamiento nativo deben validarse en un dispositivo; la web no sustituye esas pruebas.

### Conexión con la API

Sin configuración adicional se usa `https://api-production-a0b6.up.railway.app`. Para un servidor local, crear `.env.local`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.100:8080
```

Sustituir la dirección por la IP local de la computadora que ejecuta el backend. En un teléfono físico, `localhost` apunta al propio teléfono. Reiniciar Expo después de cambiar la variable. `EXPO_PUBLIC_API_URL` es pública: no colocar secretos en variables `EXPO_PUBLIC_*`.

Seguir el README de `AiChallengeBack` para iniciar PostgreSQL y la API. Comprobar `/health` antes del primer check-in.

## Verificación

```bash
npm run lint
npm run typecheck
npm test -- --runInBand
node scripts/check-appearance.cjs
node scripts/check-wellbeing.cjs
node scripts/check-mascot.cjs
```

Las pruebas cubren lógica de rutas, sesiones, preferencias y escenas, entre otras áreas. Antes de entregar, revisar también en teléfono: bienvenida, check-in, propuesta y resultado, personalización, pausa de actividades al salir y conexión con la API. Los comandos anteriores son instrucciones de verificación, no una afirmación de que se ejecutaron en cada versión.

## Compilación para TestFlight

Desde `apps/mobile` en el monorepo, con acceso autorizado al proyecto Expo/EAS y a Apple Developer/App Store Connect:

```bash
npx eas-cli@latest build -p ios --profile production --auto-submit
```

El perfil se define en `eas.json`. Confirmar la URL de API del entorno de producción antes de compilar. La disponibilidad para testers depende del procesamiento y configuración en App Store Connect.

Para una actualización de JavaScript y recursos compatible con el runtime ya instalado:

```bash
npx eas-cli@latest update --channel production --environment production --message "Descripción del cambio"
```

Los cambios de módulos nativos o configuración nativa requieren una nueva compilación. Coordinar publicaciones con el responsable de la distribución.

## Decisiones técnicas y de UX

| Decisión | Motivo y alcance |
|---|---|
| Expo y React Native con TypeScript | Compartir la interfaz móvil y mantener tipos explícitos entre pantallas y datos. Las funciones nativas se verifican en dispositivo. |
| Expo Router y componentes reutilizables | Organizar los recorridos por pantallas y mantener controles y estados consistentes. |
| TanStack Query y API separada | Gestionar consultas y mutaciones remotas sin mezclar la persistencia del servidor con la presentación. |
| Lógica de rutas y temporizadores fuera de las pantallas | Permitir pruebas de decisiones y límites de tiempo sin depender de renderizar toda la interfaz. |
| Check-in adaptativo y opción «no estoy seguro» | Reducir preguntas innecesarias y acompañar la identificación de necesidades sin exigir una explicación previa ni asignar un diagnóstico. |
| Apariencia configurable | Reconocer preferencias distintas: ninguna paleta o fuente se presenta como adecuada para todas las personas neurodivergentes. |
| Movimiento reducido, controles de sonido y modo enfoque | Dar control sobre estímulos y permitir ocultar decoración que pueda distraer. |
| Texto acompañado de caras e iconos | Apoyar la identificación de estados sin depender únicamente de color o imágenes. |
| Pausas con duración elegible y voz opcional | Permitir descansar sin completar un test; respiración y anclaje ofrecen 1, 2 o 5 minutos, y el jardín dura 2 minutos. Estos límites no se aplican a todas las actividades del centro de juegos. |
| Mascota decorativa y opcional | Aportar cercanía sin evaluar ni juzgar a la persona. La mascota usa pixel art: con «Animaciones con detalles» saluda una vez en la bienvenida y toma un sorbo al tocarla en Hoy o Ajustes. Con movimiento reducido permanece quieta; el modo enfoque la oculta. |
| Llave de dispositivo en SecureStore | Evitar pedir correo y contraseña en el flujo actual. La sesión está ligada al dispositivo; no equivale a una cuenta recuperable entre dispositivos. |

Estas decisiones reflejan la intención del diseño; su utilidad y accesibilidad deben seguir validándose con usuarios neurodivergentes. No representan eficacia clínica demostrada.

## Recursos y documentación relacionada

- Backend: repositorio del equipo `AiChallengeBack` y su README.
- Integración y distribución: [AiChallenge](https://github.com/Quique2/AiChallenge.git).
- Fuentes y licencias: `assets/fonts/SOURCES.txt` y archivos OFL junto a las fuentes.
- Procedencia de la mascota: `assets/mascot/PROVENANCE.txt` y `assets/mascot/PIXEL-PROVENANCE.json`.
- Reglas de desarrollo: `AGENTS.md`.


## Iteración de UX: recorridos cortos y resultados claros

- Hoy ofrece tres acciones principales: «Mi entorno», «Cómo estoy» y «No estoy seguro». Las pruebas en curso conservan su acceso para registrar resultados.
- Los lugares y el acceso a sus cuartos están en la pestaña Espacios. El cuarto representa el espacio; no debe interpretarse como una valoración de eficacia. El historial conserva cuántas pruebas ayudaron y cuántas se hicieron.
- El recorrido sensorial agrupa actividad y estado de ánimo, y agrupa molestia y esfuerzo. Conserva ambos datos y las áreas elegidas; con un único espacio se evita preguntarlo de nuevo. La ruta interna conserva su recorrido específico.
- Las escalas usan cinco botones grandes y etiquetados. La pregunta de utilidad va de Nada a Mucho y conserva «Todavía no lo sé» como respuesta independiente, sin nivel preseleccionado.
- La intensidad exacta se guarda **localmente en el dispositivo**, asociada a la prueba, estrategia, tarea y espacio. La API actual recibe `no` para Nada, `yes` para los niveles de Poco a Mucho y `unsure` para incertidumbre. Esta compatibilidad no convierte registros antiguos en valoraciones de cinco niveles ni sincroniza esa intensidad entre dispositivos. Al borrar la cuenta se elimina también esta información local.
- Lo que me sirve muestra la última intensidad local del mismo contexto cuando existe, junto con la evidencia de la API. Si no existe, indica que no hay valoración de intensidad.
- Al guardar se muestra estado de espera y, después de confirmarse la operación, «Guardado». Las entradas visuales respetan movimiento reducido. Un fallo de persistencia local de intensidad se informa sin volver a enviar un resultado remoto que ya se guardó.

Verificación adicional: `src/lib/__tests__/helpfulness.test.ts` cubre la interpretación de la escala, separación de contextos, validación e idempotencia del guardado local.

La vista web utiliza una sesión propia en `sessionStorage` para poder probar los recorridos; no comparte la sesión del teléfono y no conserva la llave al cerrar la sesión del navegador. La app móvil continúa usando SecureStore cifrado. Completar la bienvenida sigue siendo necesario antes de guardar datos.
