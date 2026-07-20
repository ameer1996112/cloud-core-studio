import { createFileRoute } from "@tanstack/react-router";
import { readBearerToken } from "@/lib/internalAutomationAuth.server";

async function requireAdmin(request: Request) {
  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const claims = await supabaseAdmin.auth.getClaims(token);
  const userId = claims.data?.claims?.sub;
  if (claims.error || !userId) return false;
  const profile = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return !profile.error && profile.data?.role === "admin";
}

export const Route = createFileRoute("/api/internal/messages/media/$mediaId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        if (!(await requireAdmin(request))) return new Response("Unauthorized", { status: 401 });
        if (!/^[A-Za-z0-9._-]{1,256}$/.test(params.mediaId)) {
          return new Response("Invalid media ID", { status: 400 });
        }
        const graphVersion = process.env.META_GRAPH_API_VERSION?.trim();
        const accessToken = process.env.META_ACCESS_TOKEN?.trim();
        if (!graphVersion || !accessToken)
          return new Response("Media provider unavailable", { status: 503 });
        const metadataResponse = await fetch(
          `https://graph.facebook.com/${graphVersion}/${encodeURIComponent(params.mediaId)}`,
          { headers: { authorization: `Bearer ${accessToken}` } },
        );
        if (!metadataResponse.ok)
          return new Response("Media metadata unavailable", { status: 502 });
        const metadata = (await metadataResponse.json()) as { url?: string; mime_type?: string };
        if (!metadata.url?.startsWith("https://"))
          return new Response("Invalid media URL", { status: 502 });
        const mediaResponse = await fetch(metadata.url, {
          headers: { authorization: `Bearer ${accessToken}` },
        });
        if (!mediaResponse.ok || !mediaResponse.body)
          return new Response("Media unavailable", { status: 502 });
        return new Response(mediaResponse.body, {
          status: 200,
          headers: {
            "content-type":
              metadata.mime_type ||
              mediaResponse.headers.get("content-type") ||
              "application/octet-stream",
            "cache-control": "private, no-store, max-age=0",
            "x-content-type-options": "nosniff",
          },
        });
      },
    },
  },
});
