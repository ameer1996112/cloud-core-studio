export type RawTextResponseMethod = "GET" | "HEAD";

export function buildRawTextResponse(input: {
  body: string;
  cacheControl: string;
  contentType: string;
  method?: RawTextResponseMethod;
}) {
  const contentLength = new TextEncoder().encode(input.body).byteLength;

  return new Response(input.method === "HEAD" ? null : input.body, {
    status: 200,
    headers: {
      "cache-control": input.cacheControl,
      "content-length": String(contentLength),
      "content-type": input.contentType,
    },
  });
}
