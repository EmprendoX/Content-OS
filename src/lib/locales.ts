/** Regiones del español soportadas. Sin dependencias: se usa también en la UI. */
export const LOCALES = ["es-MX", "es-ES", "es-AR", "es-CO", "es-419"] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
  "es-MX": "Español de México",
  "es-ES": "Español de España",
  "es-AR": "Español de Argentina",
  "es-CO": "Español de Colombia",
  "es-419": "Español neutro latinoamericano",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
