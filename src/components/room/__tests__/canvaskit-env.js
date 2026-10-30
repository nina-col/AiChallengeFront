'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ReactNativeEnvironment = require('jest-expo/src/preset/nativeEnvironment');

/**
 * Entorno de Jest para dibujar con Skia sin teléfono: el de jest-expo más CanvasKit (Skia en WASM,
 * lo que usa @shopify/react-native-skia en web) en `globalThis.CanvasKit`. Una prueba lo pide con
 * `@jest-environment ./src/components/room/__tests__/canvaskit-env.js` y simula
 * `@shopify/react-native-skia` con su `lib/commonjs/mock` (como el `jestSetup` de Skia).
 *
 * No se usa el `jestEnv.js` de Skia: es de Jest 29 y carga CanvasKit fuera del contexto de la
 * prueba. Aquí se evalúa dentro, porque CanvasKit revisa `colors instanceof Uint32Array` y, con
 * los constructores de otro contexto, ignora sin avisar los colores del `Atlas` (la opacidad por
 * sprite).
 */
class CanvasKitEnvironment extends ReactNativeEnvironment {
  async setup() {
    await super.setup();
    // La misma copia de CanvasKit que usa Skia, en la versión que carga en web (`LoadSkiaWeb`).
    const skia = path.dirname(require.resolve('@shopify/react-native-skia/package.json'));
    const file = require.resolve('canvaskit-wasm/bin/full/canvaskit.js', { paths: [skia] });
    const module = { exports: {} };
    const load = vm.runInContext(
      `(function (module, exports, require, __filename, __dirname) {${fs.readFileSync(file, 'utf8')}\n})`,
      this.getVmContext(),
      { filename: file },
    );
    load(module, module.exports, require, file, path.dirname(file));
    this.global.CanvasKit = await module.exports();
  }
}

module.exports = CanvasKitEnvironment;
