interface LogoProps {
  className?: string;
}

export function Logo({ className = "" }: LogoProps) {
  return (
    <svg
      viewBox="0 0 28 28"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <rect x="1"  y="1"  width="8" height="8" rx="1.5" opacity="0.70" />
      <rect x="10" y="1"  width="8" height="8" rx="1.5" opacity="0.85" />
      <rect x="1"  y="10" width="8" height="8" rx="1.5" opacity="0.85" />
      <rect x="10" y="10" width="8" height="8" rx="1.5" opacity="1"    />
      <rect x="19" y="10" width="8" height="8" rx="1.5" opacity="0.85" />
      <rect x="10" y="19" width="8" height="8" rx="1.5" opacity="0.85" />
      <rect x="19" y="19" width="8" height="8" rx="1.5" opacity="0.70" />
    </svg>
  );
}
