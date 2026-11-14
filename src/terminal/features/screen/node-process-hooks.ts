// `ProcessHooks` mot den ekte Node-prosessen (komposisjonsroten bruker denne; testene en falsk).

import { writeSync } from 'node:fs';
import type { ExitSignal, ProcessHooks } from './terminal-session';

export function nodeProcessHooks(proc: NodeJS.Process = process, fd = 1): ProcessHooks {
  return {
    onSignal(signal: ExitSignal, listener) {
      proc.on(signal, listener);
      return () => proc.off(signal, listener);
    },
    onFatal(listener) {
      proc.on('uncaughtException', listener);
      proc.on('unhandledRejection', listener);
      return () => {
        proc.off('uncaughtException', listener);
        proc.off('unhandledRejection', listener);
      };
    },
    onExit(listener) {
      proc.on('exit', listener);
      return () => proc.off('exit', listener);
    },
    writeSync(data) {
      writeSync(fd, data);
    },
  };
}
