import type { ReactNode } from 'react';

/** `vr-callout-body`. */
export function CalloutBody({ children }: { readonly children?: ReactNode }) {
  return <div className="callout-body">{children}</div>;
}
