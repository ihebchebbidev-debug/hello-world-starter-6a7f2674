import ReactDOM from "react-dom/client";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import "./styles.css";

// SPA-only client bootstrap (used by the Vercel/Render build).
// Providers (QueryClientProvider, I18nProvider, AuthProvider, TooltipProvider)
// are all installed by the root route (src/routes/__root.tsx -> RootComponent).
// Do NOT wrap them again here.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      retry: 1,
    },
  },
});

const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootEl = document.getElementById("root")!;
ReactDOM.createRoot(rootEl).render(<RouterProvider router={router} />);
