import { NextResponse, type NextRequest } from "next/server";

/**
 * Guardia de acceso local.
 * Content OS es una aplicación de un solo usuario: rechaza cualquier petición
 * cuyo Host no sea localhost / 127.0.0.1 / [::1].
 */
const ALLOWED_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

export function proxy(request: NextRequest) {
  const hostHeader = request.headers.get("host") ?? "";
  const hostname = hostHeader.replace(/:\d+$/, "").toLowerCase();

  if (!ALLOWED_HOSTS.has(hostname)) {
    return new NextResponse(
      "Content OS solo acepta conexiones desde localhost.",
      { status: 403, headers: { "content-type": "text/plain; charset=utf-8" } },
    );
  }

  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
