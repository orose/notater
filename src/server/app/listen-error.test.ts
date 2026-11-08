import { describe, expect, it } from 'vitest';
import { describeListenError } from './listen-error';

const err = (code: string): NodeJS.ErrnoException => Object.assign(new Error(`listen ${code}`), { code });

describe('describeListenError', () => {
  it('EADDRINUSE: kort norsk melding med forslag om --port', () => {
    const message = describeListenError(err('EADDRINUSE'), '127.0.0.1', 4317);
    expect(message).toBe(
      'Porten 4317 på 127.0.0.1 er allerede i bruk (kjører leseren allerede?). Stopp den andre prosessen, eller velg en annen port: npm start -- --port 4400',
    );
    expect(message).not.toMatch(/\n\s+at /);
  });

  it('EACCES: mangler tilgang til porten', () => {
    expect(describeListenError(err('EACCES'), '127.0.0.1', 80)).toMatch(/^Mangler tilgang til port 80 .*--port/);
  });

  it('andre feil: null (kalleren kaster videre)', () => {
    expect(describeListenError(err('EOTHER'), '127.0.0.1', 4317)).toBeNull();
    expect(describeListenError(new Error('x'), '127.0.0.1', 4317)).toBeNull();
  });
});
