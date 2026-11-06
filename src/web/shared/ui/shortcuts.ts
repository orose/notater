// PO-36: snarveier vises som ⌘K på Apple-plattformer og Ctrl K ellers. Selve snarveien virker
// alltid med både Meta og Ctrl (f.eks. Windows-tastatur på Mac eller Linux med Super-tast).

interface PlatformInfo {
  readonly platform: string;
  readonly userAgent: string;
  readonly userAgentData?: { readonly platform?: string } | undefined;
}

const APPLE = /mac|iphone|ipad|ipod/i;

export function isApplePlatform(info: PlatformInfo): boolean {
  const platform = info.userAgentData?.platform || info.platform;
  return APPLE.test(platform || info.userAgent);
}

function currentPlatform(): PlatformInfo {
  if (typeof navigator === 'undefined') return { platform: '', userAgent: '' };
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return { platform: navigator.platform, userAgent: navigator.userAgent, userAgentData: data };
}

/** «⌘» på macOS/iOS, ellers «Ctrl». */
export function modifierLabel(): string {
  return isApplePlatform(currentPlatform()) ? '⌘' : 'Ctrl';
}

/** «⌘K» på macOS/iOS, ellers «Ctrl K». */
export function shortcutLabel(key: string): string {
  const mod = modifierLabel();
  return mod === '⌘' ? `⌘${key}` : `${mod} ${key}`;
}

export function isModifierPressed(event: { readonly metaKey: boolean; readonly ctrlKey: boolean }): boolean {
  return event.metaKey || event.ctrlKey;
}
