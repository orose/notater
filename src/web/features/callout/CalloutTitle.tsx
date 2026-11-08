import type { ReactNode } from 'react';

/** Markør for `vr-callout-title`. <Callout> plukker ut barna; rendres aldri alene. */
export function CalloutTitle({ children }: { readonly children?: ReactNode }) {
  return <>{children}</>;
}
