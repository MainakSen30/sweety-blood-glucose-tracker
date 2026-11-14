/**
 * Authored SVG icons, one consistent 1.5px stroke at 16px. No emoji, no
 * icon-font, no external icon dependency.
 */
interface IconProps {
  className?: string;
}

function svgProps(className?: string) {
  return {
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.5,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    className,
  };
}

export function PlusIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M11.3 2.5a1.4 1.4 0 0 1 2 2L6 11.8l-2.7.7.7-2.7 7.3-7.3Z" />
    </svg>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2.5 4.5h11M6.5 2.5h3M5.5 4.5v8a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-8M6.8 7v3.8M9.2 7v3.8" />
    </svg>
  );
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function LogOutIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M6 14H4a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 4 2h2M10.5 5 13.5 8l-3 3M13.5 8H6" />
    </svg>
  );
}

export function MenuIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2.5 4h11M2.5 8h11M2.5 12h11" />
    </svg>
  );
}

export function GridIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2.5 2.5h4v4h-4zM9.5 2.5h4v4h-4zM2.5 9.5h4v4h-4zM9.5 9.5h4v4h-4z" />
    </svg>
  );
}

export function UsersIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M6 7.2a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8ZM1.8 13.5c0-2.3 1.9-4.1 4.2-4.1s4.2 1.8 4.2 4.1M10.9 2.7a2.2 2.2 0 0 1 0 4.3M11.6 9.6c1.6.4 2.7 1.9 2.7 3.6" />
    </svg>
  );
}

export function PersonIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <circle cx="8" cy="5" r="2.6" />
      <path d="M3 13.2c.6-2.3 2.6-3.9 5-3.9s4.4 1.6 5 3.9" />
    </svg>
  );
}

export function StethoscopeIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4.5 2.2v3.3a3.5 3.5 0 0 0 7 0V2.2" />
      <path d="M8 9v1.6a2.4 2.4 0 0 0 2.4 2.4h.6" />
      <circle cx="12.4" cy="13" r="1.4" />
    </svg>
  );
}

export function MailIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2 4.2h12v7.6H2zM2.3 4.6 8 9l5.7-4.4" />
    </svg>
  );
}

export function ArrowLeftIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M13.5 8h-11M6.5 4l-4 4 4 4" />
    </svg>
  );
}

export function ArrowRightIcon({ className }: IconProps) {
  return (
    <svg {...svgProps(className)}>
      <path d="M2.5 8h11M9.5 4l4 4-4 4" />
    </svg>
  );
}

/** Brand mark: a droplet inside a soft leaf shape, drawn in the palette. */
export function BrandMark({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M12 2.5c3.8 3.6 6.5 7.2 6.5 11a6.5 6.5 0 0 1-13 0c0-3.8 2.7-7.4 6.5-11Z"
        className="fill-olive-dark"
      />
      <path
        d="M12 7.5c1.9 1.9 3.2 3.9 3.2 5.9a3.2 3.2 0 0 1-6.4 0c0-2 1.3-4 3.2-5.9Z"
        className="fill-sage"
      />
    </svg>
  );
}
