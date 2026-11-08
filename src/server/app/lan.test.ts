import type { NetworkInterfaceInfo } from 'node:os';
import { describe, expect, it } from 'vitest';
import { createLanHostCheck, lanHostnames, lanUrls, lanWarning } from './lan';

const iface = (address: string, family: 'IPv4' | 'IPv6', internal = false): NetworkInterfaceInfo =>
  ({ address, family, internal, netmask: '', mac: '', cidr: null }) as NetworkInterfaceInfo;

const INTERFACES = {
  lo0: [iface('127.0.0.1', 'IPv4', true), iface('::1', 'IPv6', true)],
  en0: [iface('192.168.1.23', 'IPv4'), iface('fe80::1', 'IPv6')],
  utun3: [iface('10.8.0.2', 'IPv4')],
};

describe('LAN-modus (PO-3)', () => {
  it('lanUrls: maskinens eksterne IPv4-adresser + <hostname>.local', () => {
    expect(lanUrls(INTERFACES, 'Kundes-MacBook', 4317)).toEqual([
      'http://192.168.1.23:4317',
      'http://10.8.0.2:4317',
      'http://kundes-macbook.local:4317',
    ]);
    expect(lanUrls(INTERFACES, 'mac.local', 80)).toContain('http://mac.local:80');
  });

  it('lanHostnames: localhost, egne IPv4-adresser og <hostname>.local – ikke vilkårlige navn', () => {
    expect([...lanHostnames(INTERFACES, 'Kundes-MacBook')].sort()).toEqual(
      ['10.8.0.2', '127.0.0.1', '192.168.1.23', 'kundes-macbook.local', 'localhost'].sort(),
    );
  });

  it('vertssjekken oppdaterer adresselisten ved ukjent navn (ny IP fra DHCP), men slipper ikke inn fremmede navn', () => {
    let current: typeof INTERFACES = INTERFACES;
    let reads = 0;
    let clock = 0;
    const check = createLanHostCheck(() => (reads++, current), () => 'mac', () => clock);
    expect(check('192.168.1.23')).toBe(true);
    expect(check('mac.local')).toBe(true);
    expect(check('evil.example')).toBe(false);
    current = { ...INTERFACES, en0: [iface('192.168.1.99', 'IPv4')] };
    expect(check('192.168.1.99')).toBe(false); // innenfor 5 s: ingen nytt oppslag
    clock = 6000;
    expect(check('192.168.1.99')).toBe(true);
    expect(check('192.168.1.23')).toBe(false);
    expect(reads).toBeGreaterThan(1);
  });

  it('advarselen er tydelig og norsk og lister adressene', () => {
    const text = lanWarning(['http://192.168.1.23:4317']);
    expect(text).toMatch(/ADVARSEL/);
    expect(text).toMatch(/alle på samme nettverk/);
    expect(text).toContain('http://192.168.1.23:4317');
  });
});
