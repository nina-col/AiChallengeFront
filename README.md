# SpaceEase — App móvil (Expo)

App iOS distribuida por TestFlight, con Expo Go como plan B. Expo SDK 58, TypeScript y Expo Router (las rutas viven en `src/app/`).

> Este código se sincroniza desde el monorepo de trabajo. No hagas commits directos en el espejo `nina-col/AiChallengeFront`: avisa para integrarlos, o se sobrescriben en el siguiente sync.

## Correr en tu teléfono

```bash
npm install
npx expo start        # escanea el QR con la cámara (iOS) o con Expo Go (Android)
```

La app habla con la API en Railway (`https://api-production-a0b6.up.railway.app`). Para apuntar a otra, crea `.env.local` con `EXPO_PUBLIC_API_URL=...`.

## Antes de hacer commit

```bash
npm run lint
npm run typecheck
```

## Builds y actualizaciones

| Qué | Comando |
|---|---|
| Build nueva a TestFlight (solo si cambia algo nativo) | `eas build -p ios --profile production --auto-submit` |
| Publicar cambios de JS/UI sin recompilar | `eas update --channel production --environment production --message "..."` |

Solo se usan módulos incluidos en Expo Go, para que el plan B por QR siempre funcione.
