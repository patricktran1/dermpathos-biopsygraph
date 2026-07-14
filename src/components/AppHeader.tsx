import { Link, useRouterState } from "@tanstack/react-router";

const links = [
  { to: "/", label: "Overview" },
  { to: "/dashboard", label: "Clinical Obligations" },
  { to: "/intake", label: "Result Intake" },
  { to: "/architecture", label: "Architecture" },
] as const;

export function AppHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--lavender-soft)] text-[var(--lavender)]">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              className="h-5 w-5"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M5 12.5 9.2 17 19 7" />
              <path d="M4 4h16v16H4z" opacity=".35" />
            </svg>
          </span>
          <span className="flex flex-col leading-tight">
            <span className="font-display text-lg font-semibold tracking-tight">
              Closed Care Loop
            </span>
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Clinical obligation agent
            </span>
          </span>
        </Link>
        <nav className="hidden items-center gap-1 md:flex">
          {links.map((link) => {
            const active =
              link.to === "/" ? pathname === "/" : pathname.startsWith(link.to);
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? "bg-[var(--lavender-soft)] text-[var(--lavender)]"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
