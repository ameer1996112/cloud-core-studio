import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
const decoder = new TextDecoder();
const root = resolve(import.meta.dir, "../..");
function renderMemberState(state: Record<string, unknown>) {
  const script = `
import { mock } from "bun:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as actualRouter from "@tanstack/react-router";
import * as actualReactStart from "@tanstack/react-start";
import * as actualReactQuery from "@tanstack/react-query";

const queryState = ${JSON.stringify(state)};
mock.module("@tanstack/react-router", () => ({
  ...actualRouter,
  createFileRoute: () => (options) => ({ options, useParams: () => ({id:"fixture"}) }),
  Link: ({ children, to, params: _params, ...props }) =>
    React.createElement("a", { href: String(to), ...props }, children),
}));
mock.module("@tanstack/react-start", () => ({
  ...actualReactStart,
  createClientOnlyFn: (fn) => fn,
  useServerFn: () => () => Promise.resolve(null),
}));
mock.module("@tanstack/react-query", () => ({
  ...actualReactQuery,
  useQuery: () => ({
    data: undefined,
    ...queryState,

    error: null,
    refetch() {},
  }),
  useMutation: () => ({
    mutate() {},
    mutateAsync: async () => undefined,
    isPending: false,
    variables: undefined,
  }),
  useQueryClient: () => ({ invalidateQueries() {} }),
}));
mock.module("@/lib/i18n", () => ({
  getActiveLang: () => "en",
  getLocale: () => "en-US",
  labelForMethod: (value) => String(value),
  labelForStatus: (value) => String(value),
  t: (key) => key,
  tForLang: (_lang, key) => key,
  useI18n: () => ({
    lang: "en",
    locale: "en-US",
    dir: "ltr",
    t: (key) => key,
  }),
}));
mock.module("@/hooks/useDocumentTitle", () => ({ useDocumentTitle() {} }));
mock.module("@/integrations/supabase/client", () => ({ supabase: { storage: { from: () => ({}) } } }));

const routeModule = await import(${JSON.stringify(resolve(root, "src/routes/_authenticated/admin/members/$id.tsx"))});
process.stdout.write(renderToStaticMarkup(React.createElement(routeModule.Route.options.component)));
`;
  const result = Bun.spawnSync({
    cmd: [process.execPath, "-e", script],
    cwd: root,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(decoder.decode(result.stderr) || "Could not render member details");
  }
  return decoder.decode(result.stdout);
}

describe("member details request recovery", () => {
  test("an exhausted request presents an error and retry rather than a permanent skeleton", () => {
    const html = renderMemberState({ isError: true, isLoading: false, isFetching: false });
    expect(html).toContain('role="alert"');
    expect(html).toContain("admin.memberDetail.loadError");
    expect(html).toContain("common.retry");
    expect(html).toContain('href="/admin/members"');
    expect(html).not.toContain("animate-pulse");
  });
  test("a confirmed missing member has its own recovery path without a misleading retry", () => {
    const html = renderMemberState({ data: { member: null }, isError: false, isLoading: false });
    expect(html).toContain("admin.memberDetail.notFound");
    expect(html).not.toContain("common.retry");
    expect(html).not.toContain("animate-pulse");
  });
  test("the initial request retains an announced loading state", () => {
    const html = renderMemberState({ isLoading: true, isError: false });
    expect(html).toContain('role="status"');
    expect(html).toContain("common.loading");
    expect(html).toContain("animate-pulse");
  });
});
