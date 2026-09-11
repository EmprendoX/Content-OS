import { revalidatePath } from "next/cache";

export type ActionResult<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

/** Actor humano por defecto: la aplicación es de un solo usuario. */
export const HUMAN_ACTOR = "humano";

const ALL_PATHS = ["/", "/brands", "/knowledge", "/ideas", "/studio", "/approvals", "/calendar", "/connections", "/results", "/settings"];

export function revalidateAll() {
  for (const path of ALL_PATHS) revalidatePath(path, "layout");
}

/** Envuelve una acción: captura errores y los devuelve como resultado tipado. */
export async function safeAction<T>(fn: () => Promise<T> | T, message?: string): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    revalidateAll();
    return { ok: true, data, message };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export function parseLines(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function str(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}
