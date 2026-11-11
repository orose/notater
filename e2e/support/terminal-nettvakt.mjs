// Nettverksvakt for terminaltestene (v3, B10 og T7 «frittstående»). Lastes i presentasjonsprosessen med
// NODE_OPTIONS="--import <denne fila>" av e2e/support/terminal.ts. Alle TCP-tilkoblinger (også til 127.0.0.1 –
// terminalvarianten skal ikke snakke med web-serveren) logges som JSON-linjer til fila i QA_NETTLOGG, og testen
// feiler hvis fila ikke er tom. Unix-sokler (IPC) er lov. npm-prosessen selv (oppdateringssjekk o.l.) ignoreres.
import { appendFileSync } from 'node:fs';
import { Socket } from 'node:net';
import { argv, env, pid } from 'node:process';

const logg = env.QA_NETTLOGG;
const erNpm = argv.some((a) => /npm-cli\.js$|[\\/]npm$/.test(a));

if (logg && !erNpm) {
  const opprinnelig = Socket.prototype.connect;
  Socket.prototype.connect = function connect(...args) {
    // net.connect() sender de normaliserte argumentene som én liste: [[{ port, host }, cb]].
    const [første, andre] = Array.isArray(args[0]) ? args[0] : args;
    const mål =
      typeof første === 'object' && første !== null
        ? første
        : typeof første === 'number' || (typeof første === 'string' && /^\d+$/.test(første))
          ? { port: Number(første), host: typeof andre === 'string' ? andre : 'localhost' }
          : { path: første };
    if (mål.path === undefined || mål.port !== undefined) {
      try {
        appendFileSync(logg, `${JSON.stringify({ pid, host: mål.host ?? 'localhost', port: mål.port ?? null, argv: argv.slice(1, 3) })}\n`);
      } catch {
        // Vakten skal aldri selv velte prosessen.
      }
    }
    return opprinnelig.apply(this, args);
  };
}
