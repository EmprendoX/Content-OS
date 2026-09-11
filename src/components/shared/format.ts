import { format, formatDistanceToNow, isValid, parseISO } from "date-fns";
import { es } from "date-fns/locale";

export function fmtDate(value: string | null | undefined, pattern = "d MMM yyyy"): string {
  if (!value) return "—";
  const date = parseISO(value);
  return isValid(date) ? format(date, pattern, { locale: es }) : "—";
}

export function fmtDateTime(value: string | null | undefined): string {
  return fmtDate(value, "d MMM yyyy, HH:mm");
}

export function fmtRelative(value: string | null | undefined): string {
  if (!value) return "—";
  const date = parseISO(value);
  return isValid(date) ? formatDistanceToNow(date, { addSuffix: true, locale: es }) : "—";
}

/** Valor para <input type="datetime-local"> en hora local. */
export function toLocalInput(value: string | null | undefined): string {
  if (!value) return "";
  const date = parseISO(value);
  if (!isValid(date)) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function fmtNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("es-ES").format(value);
}

export function truncate(text: string, max = 80): string {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}
