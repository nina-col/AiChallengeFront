const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, requireStub = () => ({})) {
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  const exports = {};
  vm.runInNewContext(code, { exports, require: requireStub });
  return exports;
}
const { appearanceFrom, APPEARANCE_DEFAULTS, isDarkAppearance } = load('src/lib/appearance.ts');
const plain = (value) => JSON.parse(JSON.stringify(value));
assert.deepEqual(plain(appearanceFrom(null)), plain(APPEARANCE_DEFAULTS));
// Upgrade from the old settings format must preserve the person's existing choices.
const upgraded = appearanceFrom({ showDesk: false, softContrast: true, sounds: true, onboarded: true });
assert.equal(upgraded.showDesk, false);
assert.equal(upgraded.softContrast, true);
assert.equal(upgraded.font, 'system');
assert.equal('sounds' in upgraded, false); // Appearance reset/save never patches unrelated settings.
assert.equal('onboarded' in upgraded, false);
const invalid = appearanceFrom({ themeMode: 'unknown', textSize: 300, font: null, showMascot: 'false', focusMode: true });
assert.equal(invalid.themeMode, 'system');
assert.equal(invalid.textSize, 'standard');
assert.equal(invalid.showMascot, true);
assert.equal(invalid.focusMode, true);
for (const mode of ['light', 'dark', 'system']) {
  for (const system of ['light', 'dark', null]) {
    assert.equal(isDarkAppearance({ ...APPEARANCE_DEFAULTS, themeMode: mode }, system), mode === 'dark' || (mode === 'system' && system === 'dark'));
  }
}
const { Colors } = load('src/constants/theme.ts', (name) => {
  if (name === 'react-native') return { Platform: { select: (options) => options.default } };
  if (name === 'react-native-reanimated') return { Easing: { bezier: () => {} } };
  return {};
});
const { ExtraPalettes } = load('src/constants/palettes.ts');
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map((part) => parseInt(part, 16) / 255)
    .map((n) => n <= 0.04045 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}
function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
const palettes = { ...Colors };
for (const [name, modes] of Object.entries(ExtraPalettes)) {
  for (const [mode, palette] of Object.entries(modes)) {
    palettes[`${name}-${mode}`] = palette;
    palettes[`${name}-${mode}-soft`] = { ...palette, backgroundElement: palette.background };
  }
}
for (const [name, palette] of Object.entries(palettes)) {
  for (const text of ['text', 'textSecondary', 'primary']) {
    for (const bg of ['background', 'backgroundElement', 'backgroundSelected']) {
      const ratio = contrast(palette[text], palette[bg]);
      assert.ok(ratio >= 4.5, `${name}: ${text} on ${bg} is ${ratio.toFixed(2)}:1`);
    }
  }
  assert.ok(contrast(palette.onPrimary, palette.primary) >= 4.5, `${name}: primary button contrast`);
}
console.log(`Appearance: migration, invalid data, theme override and AA contrast passed (${Object.keys(palettes).length} palettes).`);
