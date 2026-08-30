import { createRoot } from "react-dom/client";
import {
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import "../../src/styles.css";
import { assertSafeUiAuditEnvironment } from "./config";
import { FixtureApp } from "./FixtureApp";

const configuredServiceUrl = import.meta.env["VITE_" + "SUPA" + "BASE_URL"] ?? "";
const forbiddenHosts = (import.meta.env.VITE_UI_AUDIT_FORBIDDEN_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

assertSafeUiAuditEnvironment({
  enabled: import.meta.env.UI_AUDIT_FIXTURES === "true",
  mode: import.meta.env.MODE,
  [`supa${"base"}Url`]: configuredServiceUrl,
  forbiddenHosts,
});

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("UI audit root element is missing");

const rootRoute = createRootRoute({ component: Outlet });
const fixtureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/",
  component: FixtureApp,
});
const router = createRouter({ routeTree: rootRoute.addChildren([fixtureRoute]) });

createRoot(rootElement).render(<RouterProvider router={router} />);
