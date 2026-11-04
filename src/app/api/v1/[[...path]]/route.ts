import { runtime as backend } from "@/server/runtime";
import { id } from "@/server/util";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;
async function handle(request: Request) {
  try {
    return await backend().handle(request);
  } catch {
    const request_id = id("req");
    return Response.json(
      {
        error: {
          code: "INTERNAL",
          message: "Backend configuration is unavailable.",
          status: 500,
          request_id,
          retryable: false,
        },
      },
      {
        status: 500,
        headers: { "X-Request-Id": request_id, "Cache-Control": "no-store" },
      },
    );
  }
}
export { handle as GET, handle as POST, handle as DELETE };
