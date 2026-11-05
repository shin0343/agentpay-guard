/** Development ingress: expose only the existing webhook POST, never the console. */
import { createServer } from "node:http";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

const route = "/api/v1/webhooks/paypal";
const signatureHeaders = [
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-time",
  "paypal-transmission-sig",
];
export function createWebhookProxy(
  options: {
    transport?: typeof fetch;
    receiptDirectory?: string;
  } = {},
) {
  const transport = options.transport ?? fetch;
  return createServer(async (req, res) => {
    if (req.method !== "POST" || req.url !== route) {
      res.writeHead(404).end();
      return;
    }
    try {
      const chunks: Buffer[] = [];
      let bytes = 0;
      for await (const chunk of req) {
        const part = Buffer.from(chunk);
        bytes += part.length;
        if (bytes > 65536) {
          res.writeHead(413).end();
          return;
        }
        chunks.push(part);
      }
      const raw = Buffer.concat(chunks);
      const headers = new Headers();
      // Do not forward cookies, authorization, host, proxy identity or arbitrary headers.
      for (const name of ["content-type", ...signatureHeaders]) {
        const value = req.headers[name];
        if (typeof value === "string") headers.set(name, value);
      }
      const response = await transport(`http://127.0.0.1:3100${route}`, {
        method: "POST",
        headers,
        body: raw,
        redirect: "error",
        signal: AbortSignal.timeout(45000),
      });
      const responseBody = await response.text();
      if (
        response.status === 200 &&
        options.receiptDirectory &&
        signatureHeaders.every((name) => headers.has(name))
      ) {
        // Private, ignored evidence: retain original bytes and signature headers for
        // independent verification. Never log payer data or raw bodies to stdout.
        await mkdir(options.receiptDirectory, { recursive: true, mode: 0o700 });
        await writeFile(
          `${options.receiptDirectory}/${Date.now()}-${randomUUID()}.json`,
          JSON.stringify(
            {
              received_at: new Date().toISOString(),
              raw_body_base64: raw.toString("base64"),
              raw_sha256: createHash("sha256").update(raw).digest("hex"),
              headers: Object.fromEntries(headers),
              app_status: response.status,
              app_request_id: response.headers.get("x-request-id"),
            },
            null,
            2,
          ),
          { mode: 0o600 },
        );
      }
      res.setHeader("Cache-Control", "no-store");
      res.setHeader(
        "Content-Type",
        response.headers.get("content-type") ?? "application/json",
      );
      const trace = response.headers.get("x-request-id");
      if (trace) res.setHeader("X-Request-Id", trace);
      res.writeHead(response.status).end(responseBody);
    } catch {
      if (!res.headersSent) res.writeHead(503).end();
      else res.end();
    }
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const server = createWebhookProxy({
    receiptDirectory: "qa/tunnel-live/receipts",
  });
  server.listen(3102, "127.0.0.1", () =>
    console.log("Webhook-only proxy listening on 127.0.0.1:3102"),
  );
  for (const signal of ["SIGINT", "SIGTERM"] as const)
    process.on(signal, () => server.close(() => process.exit(0)));
}
