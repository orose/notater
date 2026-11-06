/**
 * PO-3: LAN-modus (`--lan`). Serveren binder 0.0.0.0 så mobilen på hjemmenettet når den. Vernet mot
 * DNS-rebinding (A16) beholdes: `Host` må være localhost, en av maskinens egne IPv4-adresser eller
 * `<hostname>.local`. Rene funksjoner; nettverksgrensesnittene sendes inn.
 */
import type { NetworkInterfaceInfo } from 'node:os';

export type NetworkInterfaces = Readonly<Record<string, readonly NetworkInterfaceInfo[] | undefined>>;

const LOCAL_HOSTNAMES = ['127.0.0.1', 'localhost'];

function ipv4Addresses(interfaces: NetworkInterfaces, includeInternal: boolean): string[] {
  const addresses: string[] = [];
  for (const list of Object.values(interfaces)) {
    for (const info of list ?? []) {
      // Node < 18.4 brukte tallet 4 i stedet for 'IPv4'.
      const family: unknown = info.family;
      if ((family === 'IPv4' || family === 4) && (includeInternal || !info.internal)) addresses.push(info.address);
    }
  }
  return [...new Set(addresses)];
}

/** `Kundes-MacBook` → `kundes-macbook.local` (Bonjour/mDNS-navnet på macOS). */
function mdnsName(hostname: string): string {
  const name = hostname.trim().toLowerCase();
  return name.endsWith('.local') ? name : `${name}.local`;
}

/** Vertsnavn som godtas i `Host` i LAN-modus. */
export function lanHostnames(interfaces: NetworkInterfaces, hostname: string): ReadonlySet<string> {
  return new Set([...LOCAL_HOSTNAMES, ...ipv4Addresses(interfaces, true), mdnsName(hostname)]);
}

/** Adressene som skrives ut ved oppstart (de som kan åpnes fra mobilen). */
export function lanUrls(interfaces: NetworkInterfaces, hostname: string, port: number): string[] {
  return [...ipv4Addresses(interfaces, false), mdnsName(hostname)].map((host) => `http://${host}:${port}`);
}

/** Minste tid mellom nye oppslag av nettverksgrensesnittene når et ukjent vertsnavn dukker opp. */
const REFRESH_MS = 5000;

/**
 * Vertssjekk for LAN-modus. Adresselisten caches; ved et ukjent navn leses grensesnittene på nytt
 * (høyst hvert 5. s), slik at en ny IP fra DHCP virker uten omstart.
 */
export function createLanHostCheck(
  readInterfaces: () => NetworkInterfaces,
  readHostname: () => string,
  now: () => number = Date.now,
): (hostname: string) => boolean {
  let allowed = lanHostnames(readInterfaces(), readHostname());
  let refreshedAt = now();
  return (hostname) => {
    if (allowed.has(hostname)) return true;
    if (now() - refreshedAt < REFRESH_MS) return false;
    allowed = lanHostnames(readInterfaces(), readHostname());
    refreshedAt = now();
    return allowed.has(hostname);
  };
}

/** Tydelig norsk advarsel ved oppstart i LAN-modus. */
export function lanWarning(urls: readonly string[]): string {
  return [
    '',
    'ADVARSEL: LAN-modus (--lan) er på. Leseren lytter på alle nettverkskort (0.0.0.0),',
    'så alle på samme nettverk kan lese vaultet ditt – uten passord. Bruk det bare på et nettverk du stoler på',
    '(hjemme), aldri på kafé, hotell eller jobbens gjestenett. Start uten --lan for å slå det av.',
    '',
    'Åpne på mobilen (samme Wi-Fi):',
    ...(urls.length > 0 ? urls.map((u) => `  ${u}`) : ['  (fant ingen IPv4-adresse – er maskinen koblet til et nettverk?)']),
    '',
  ].join('\n');
}
