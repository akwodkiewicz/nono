import type { ButtonHTMLAttributes, ReactNode } from 'react';

/*
 * The app's three interactive primitives. Deliberately tiny: primary reads as
 * a filled nonogram cell (ink), secondary is a hairline outline, quiet is
 * text-only chrome. Controls are rounded-lg per the shape lock.
 */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium ' +
  'transition-colors duration-150 motion-safe:active:scale-[0.98] ' +
  'disabled:pointer-events-none disabled:opacity-40';

const BUTTON_VARIANTS = {
  primary: 'bg-ink text-paper hover:bg-ink/85',
  secondary: 'border border-line bg-surface text-ink hover:bg-ink/5',
  quiet: 'text-muted hover:bg-ink/5 hover:text-ink',
} as const;

const BUTTON_SIZES = {
  sm: 'px-2.5 py-1 text-sm',
  md: 'px-4 py-1.5 text-sm',
  lg: 'px-6 py-2.5 text-base',
} as const;

export function Button({
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  children: ReactNode;
}) {
  return (
    <button
      className={`${BUTTON_BASE} ${BUTTON_VARIANTS[variant]} ${BUTTON_SIZES[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Small square control for per-row actions (insert/remove a clue line). */
export function IconButton({
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button
      className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted transition-colors duration-150 hover:bg-ink/5 hover:text-ink disabled:pointer-events-none disabled:opacity-30 motion-safe:active:scale-[0.98] ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Hairline-framed surface; panels are rounded-xl per the shape lock. */
export function Panel({
  className = '',
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={`rounded-xl border border-line bg-surface ${className}`}>{children}</div>
  );
}
