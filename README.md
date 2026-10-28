# SpaceEase — App móvil (Expo)

App iOS distribuida por TestFlight, con Expo Go como plan B. Expo SDK 58, TypeScript y Expo Router (las rutas viven en `src/app/`).

> **Para el equipo:** aquí se puede trabajar. Este repo es el espejo de `apps/mobile` del monorepo de trabajo.
> - Antes de empezar, `git pull`: los commits `sync monorepo@…` traen lo que cambió en el monorepo.
> - Haz commits normales en `main` (o una rama con PR), nunca force-push.
> - Quique los trae al monorepo uno por uno con `scripts/import-team-repos.sh`, con tu nombre como autor. Ahí se revisan (tipos, lint y pruebas) y luego llegan a la app.
> - El siguiente sync no sobrescribe tu trabajo: se detiene si encuentra commits tuyos que todavía no se importaron.

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
