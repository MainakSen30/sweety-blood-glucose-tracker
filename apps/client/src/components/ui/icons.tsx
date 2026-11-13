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
