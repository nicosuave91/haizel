import {
  RouterProvider,
  createRouter,
  createRoute,
  createRootRoute,
  Outlet
} from "@tanstack/react-router";
import { AppShell } from "../layouts/AppShell";
import { DashboardPage } from "@/features/dashboard/DashboardPage";
import { PipelinePage } from "@/features/pipeline/PipelinePage";
import { ChatsPage } from "@/features/chats/ChatsPage";

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  )
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: DashboardPage
});

const pipelineRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "pipeline",
  component: PipelinePage
});

const chatsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "chats",
  component: ChatsPage
});

const routeTree = rootRoute.addChildren([indexRoute, pipelineRoute, chatsRoute]);

const router = createRouter({ routeTree, defaultPreload: "intent" });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export const AppRouter = () => {
  return <RouterProvider router={router} />;
};
