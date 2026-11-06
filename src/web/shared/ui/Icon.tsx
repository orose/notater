import type { ReactNode } from 'react';

// 1,6 px strek-ikoner fra prototypen (docs/design/prototype.html, <symbol>-spriten).
const ICONS = {
  note: <path d="M4 20h4L19 9l-4-4L4 16v4zM14 6l4 4" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.01" />
    </>
  ),
  tip: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3z" />,
  warning: <path d="M12 3.5 2.5 20h19L12 3.5zM12 10v4.5M12 17.2v.01" />,
  danger: <path d="M13 2.5 4.5 14H11l-1 7.5L19.5 10H13l1-7.5z" />,
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.2a2.6 2.6 0 1 1 3.6 2.4c-.7.3-1.1.9-1.1 1.6v.5M12 17v.01" />
    </>
  ),
  example: <path d="M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01" />,
  quote: <path d="M6 8h4v4c0 2.8-1.4 4.6-4 5.5M14 8h4v4c0 2.8-1.4 4.6-4 5.5" />,
  bug: (
    <>
      <rect x="8" y="7" width="8" height="12" rx="4" />
      <path d="M12 11v8M8 12H4M20 12h-4M8 16.5H4.5M19.5 16.5H16M9.5 4.5 11 7M14.5 4.5 13 7" />
    </>
  ),
  success: <path d="M4.5 12.5l4.5 4.5L19.5 6.5" />,
  failure: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  abstract: (
    <>
      <rect x="5.5" y="4.5" width="13" height="16" rx="1.5" />
      <path d="M9 3.5h6v2H9zM9 10h6M9 13.5h6M9 17h3.5" />
    </>
  ),
  todo: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.2 12.3l2.6 2.6 5-5.6" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.8-4.8" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  theme: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
    </>
  ),
  copy: (
    <>
      <rect x="8.5" y="8.5" width="11" height="11" rx="1.5" />
      <path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5" />
    </>
  ),
  chev: <path d="M9 6l6 6-6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  expand: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  keys: (
    <>
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14h10" />
    </>
  ),
  zen: <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />,
  base: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="1.5" />
      <path d="M3.5 9.5h17M9.5 9.5v10" />
    </>
  ),
  block: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 4l16 16" />
    </>
  ),
  embed: <path d="M8 7 3.5 12 8 17M16 7l4.5 5-4.5 5" />,
  image: (
    <>
      <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
      <path d="M3.5 16l5-5 4 4 3-3 5 5" />
      <circle cx="15.5" cy="9.5" r="1.3" />
    </>
  ),
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, className }: { readonly name: IconName; readonly className?: string }) {
  return (
    <svg className={className ? `i ${className}` : 'i'} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {ICONS[name]}
    </svg>
  );
}
