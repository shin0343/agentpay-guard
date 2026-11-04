import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { StoreState, Principal, User } from "../model";
import { Fault, hash } from "../util";
export const people: Record<string, User> = {
  reviewer: { id: "usr_okafor", name: "M. Okafor", role: "reviewer" },
  operator: { id: "usr_lindqvist", name: "S. Lindqvist", role: "operator" },
};
export const equal = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
export function cookies(req: Request) {
  return Object.fromEntries(
    (req.headers.get("cookie") ?? "").split(";").map((x) => {
      const i = x.indexOf("=");
      return [x.slice(0, i).trim(), x.slice(i + 1)];
    }),
  );
}
export class Auth {
  constructor(
    private secret: string,
    private secure: boolean,
  ) {
    if (secret.length < 32)
      throw new Error("SESSION_SECRET must contain at least 32 characters");
  }
  private sign(s: string) {
    return createHmac("sha256", this.secret).update(s).digest("base64url");
  }
  issue(user: User) {
    const csrf = randomBytes(24).toString("hex");
    const payload = Buffer.from(
      JSON.stringify({ user, csrf, exp: Date.now() + 8 * 3600000 }),
    ).toString("base64url");
    const flags = `Path=/; SameSite=Lax; Max-Age=28800${this.secure ? "; Secure" : ""}`;
    return [
      `apg_session=${payload}.${this.sign(payload)}; HttpOnly; ${flags}`,
      `apg_csrf=${csrf}; ${flags}`,
    ];
  }
  authenticate(req: Request, s: StoreState): Principal {
    const bearer = req.headers.get("authorization");
    if (bearer) {
      const key = bearer.match(/^Bearer (agk_test_[A-Za-z0-9_-]{32})$/)?.[1];
      const agent = key
        ? Object.values(s.agents).find((a) => equal(a.key_hash, hash(key)))
        : undefined;
      if (!agent)
        throw new Fault("UNAUTHENTICATED", 401, "Invalid agent credential.");
      return { kind: "agent", id: agent.id, name: agent.name };
    }
    try {
      const c = cookies(req);
      const [payload, sig] = (c.apg_session ?? "").split(".");
      if (!payload || !sig || !equal(sig, this.sign(payload)))
        throw new Error();
      const data = JSON.parse(Buffer.from(payload, "base64url").toString());
      const user = people[data.user?.role];
      if (!user || user.id !== data.user.id || data.exp <= Date.now())
        throw new Error();
      if (
        req.method !== "GET" &&
        (!c.apg_csrf ||
          !equal(c.apg_csrf, data.csrf) ||
          !equal(c.apg_csrf, req.headers.get("x-csrf-token") ?? ""))
      )
        throw new Fault("CSRF_FAILED", 403, "Invalid CSRF token.");
      return { kind: user.role, id: user.id, name: user.name };
    } catch (e) {
      if (e instanceof Fault) throw e;
      throw new Fault("UNAUTHENTICATED", 401, "Sign in to continue.");
    }
  }
}
export function operator(p: Principal) {
  if (p.kind === "agent")
    throw new Fault("FORBIDDEN", 403, "An operator session is required.");
}
export function limit(s: StoreState, key: string, max: number, ms = 60000) {
  const at = Date.now();
  let b = s.limits[key];
  if (!b || b.until <= at)
    b = s.limits[key] = { id: key, count: 0, until: at + ms };
  b.count++;
  return b.count <= max;
}
