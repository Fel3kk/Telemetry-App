import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import "../styles.css";
import { reportLovableError } from "../lib/lovable-error-reporting";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "F1 Telemetry Analyzer" },
      { name: "description", content: "Season standings, race stories, and telemetry from your F1 uploads." },
      { name: "author", content: "F1 Telemetry Analyzer" },
      { property: "og:title", content: "F1 Telemetry Analyzer" },
      { property: "og:description", content: "Season standings, race stories, and telemetry from your F1 uploads." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "F1 Telemetry Analyzer" },
      { name: "twitter:description", content: "Season standings, race stories, and telemetry from your F1 uploads." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/503b8ee5-72ad-4360-b420-85c00bc49a9d/id-preview-15595008--92064a28-4347-49e0-9ccd-3d4853040e8e.lovable.app-1784146677592.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/503b8ee5-72ad-4360-b420-85c00bc49a9d/id-preview-15595008--92064a28-4347-49e0-9ccd-3d4853040e8e.lovable.app-1784146677592.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGate>
        <Outlet />
      </AuthGate>
    </QueryClientProvider>
  );
}

function AuthGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  useEffect(() => {
    let active = true;
    import("@/lib/supabase").then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        if (!active) return;
        setAuthed(!!data.session);
        setReady(true);
      });
      const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
        setAuthed(!!s);
        router.invalidate();
      });
      return () => sub.subscription.unsubscribe();
    });
    return () => { active = false; };
  }, [router]);

  if (!ready) return <div className="flex min-h-screen items-center justify-center bg-[#0a0a0f] text-white/60 text-sm">Loading…</div>;
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (!authed && path !== "/auth") {
    if (typeof window !== "undefined") window.location.replace("/auth");
    return null;
  }
  return <>{children}</>;
}
