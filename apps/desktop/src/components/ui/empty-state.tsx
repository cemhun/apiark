/** Reusable empty state with optional SVG icon, title, and description. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center animate-fade-in">
      <div className="text-(--color-text-dimmed)">{icon}</div>
      <div>
        <p className="text-sm font-medium text-(--color-text-muted)">{title}</p>
        {description && (
          <p className="mt-1 text-xs text-(--color-text-dimmed)">{description}</p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

/* ─── SVG Illustrations ─── */

export function RocketIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 4C24 4 16 14 16 28C16 32 18 36 24 40C30 36 32 32 32 28C32 14 24 4 24 4Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 40V44" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 28C12 28 8 30 8 30L16 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M32 28C36 28 40 30 40 30L32 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="20" r="3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function FolderPlusIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 12C6 10.3431 7.34315 9 9 9H18L22 14H39C40.6569 14 42 15.3431 42 17V36C42 37.6569 40.6569 39 39 39H9C7.34315 39 6 37.6569 6 36V12Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 22V34" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M18 28H30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function ClockEmptyIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 14V24L30 30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ClipboardCheckIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M16 8H12C10.3431 8 9 9.34315 9 11V40C9 41.6569 10.3431 43 12 43H36C37.6569 43 39 41.6569 39 40V11C39 9.34315 37.6569 8 36 8H32" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="16" y="4" width="16" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M17 26L22 31L31 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsGearIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="1.5" />
      <path d="M24 4V10M24 38V44M4 24H10M38 24H44M9.86 9.86L14.1 14.1M33.9 33.9L38.14 38.14M38.14 9.86L33.9 14.1M14.1 33.9L9.86 38.14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WarningTriangleIcon({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M24 6L4 42H44L24 6Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M24 20V30" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="24" cy="36" r="1.5" fill="currentColor" />
    </svg>
  );
}
