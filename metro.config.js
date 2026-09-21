// Learn more https://docs.expo.dev/guides/customizing-metro
const http = require('http');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// expo-sqlite on web runs wa-sqlite (WebAssembly).
config.resolver.assetExts.push('wasm');
// Drizzle migrations are bundled as raw .sql strings (see babel.config.js).
config.resolver.sourceExts.push('sql');

// expo-sqlite on web needs SharedArrayBuffer, which requires cross-origin isolation
// (COOP/COEP headers). Expo's dev server serves index.html *before* Metro's middleware,
// so `server.enhanceMiddleware` never sees that request. Instead, add the headers to every
// response of this dev-server process. Production hosting must send the same headers
// (see CLAUDE.md → "Web / SQLite").
const COI_PATCHED = Symbol.for('habits.crossOriginIsolation');
if (!http.ServerResponse.prototype[COI_PATCHED]) {
  const originalWriteHead = http.ServerResponse.prototype.writeHead;
  http.ServerResponse.prototype.writeHead = function writeHead(...args) {
    if (!this.headersSent) {
      this.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      this.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }
    return originalWriteHead.apply(this, args);
  };
  http.ServerResponse.prototype[COI_PATCHED] = true;
}

module.exports = config;
