import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [location] = useLocation();

  return (
    <nav className="border-b">
      <div className="container mx-auto">
        <div className="flex h-16 items-center">
          <div className="flex">
            <Link href="/">
              <span
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors hover:text-primary cursor-pointer",
                  location === "/" ? "text-foreground" : "text-muted-foreground"
                )}
              >
                Dashboard
              </span>
            </Link>
            <Link href="/rules">
              <span
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors hover:text-primary cursor-pointer",
                  location === "/rules"
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                Rules
              </span>
            </Link>
            <Link href="/history">
              <span
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors hover:text-primary cursor-pointer",
                  location === "/history"
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                History
              </span>
            </Link>
            <Link href="/settings">
              <span
                className={cn(
                  "px-3 py-2 text-sm font-medium transition-colors hover:text-primary cursor-pointer",
                  location === "/settings"
                    ? "text-foreground"
                    : "text-muted-foreground"
                )}
              >
                Settings
              </span>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}