import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // better-sqlite3 es un módulo nativo: debe quedar fuera del bundle.
  serverExternalPackages: ["better-sqlite3"],
  // Aplicación local: no enviamos telemetría ni cabeceras de despliegue.
  poweredByHeader: false,
};

export default nextConfig;
