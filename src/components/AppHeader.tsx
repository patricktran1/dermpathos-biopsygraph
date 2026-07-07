import { Link, useRouterState } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Welcome" },
  { to: "/intake", label: "Case Intake" },
  { to: "/dashboard", label: "Action Dashboard" },
  { to: "/follow-up", label: "Follow-Up Queue" },
  { to: "/architecture", label: "Integration Architecture" },
] as const;

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--lavender-soft)] text-[var(--lavender)]">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" stroke="currentColor" strokeWidth="2">
              <path d="M12 3c3 4 6 6.5 6 10a6 6 0 1 1-12 0c0-3.5 3-6 6-10z" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-semibold tracking-tight">
              DermPathOS
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              BiopsyGraph · MVP
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((l) => {
            const active =
              l.to === "/" ? pathname === "/" : pathname.startsWith(l.to);
            return (
              <Link
                key={l.to}
                to={l.to}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-[var(--lavender-soft)] text-[var(--lavender)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
