import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Cifrado local de tokens (AES-256-GCM).
 * La clave se lee de CONTENT_OS_ENCRYPTION_KEY; si no existe, se genera y se
 * guarda en ./data/.encryption-key con permisos 0600.
 */
const ALGORITHM = "aes-256-gcm";
const KEY_FILE = path.resolve(process.cwd(), "data", ".encryption-key");

let cachedKey: Buffer | null = null;

function loadKey(): Buffer {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.CONTENT_OS_ENCRYPTION_KEY?.trim();
  if (fromEnv) {
    if (!/^[0-9a-fA-F]{64}$/.test(fromEnv)) {
      throw new Error("CONTENT_OS_ENCRYPTION_KEY debe tener 64 caracteres hexadecimales (32 bytes).");
    }
    cachedKey = Buffer.from(fromEnv, "hex");
    return cachedKey;
  }

  if (fs.existsSync(KEY_FILE)) {
    const stored = fs.readFileSync(KEY_FILE, "utf8").trim();
    if (/^[0-9a-fA-F]{64}$/.test(stored)) {
      cachedKey = Buffer.from(stored, "hex");
      return cachedKey;
    }
  }

  const generated = randomBytes(32);
  fs.mkdirSync(path.dirname(KEY_FILE), { recursive: true });
  fs.writeFileSync(KEY_FILE, generated.toString("hex"), { mode: 0o600 });
  cachedKey = generated;
  return cachedKey;
}

export function encryptionKeySource(): "env" | "file" {
  return process.env.CONTENT_OS_ENCRYPTION_KEY?.trim() ? "env" : "file";
}

/** Devuelve "iv.tag.ciphertext" en base64url. */
export function encryptSecret(plain: string): string {
  const key = loadKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, encrypted].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(payload: string): string {
  const key = loadKey();
  const parts = payload.split(".");
  if (parts.length !== 3) throw new Error("Formato de secreto cifrado inválido.");
  const [iv, tag, data] = parts.map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

/** Muestra solo los últimos 4 caracteres para la interfaz. */
export function maskSecret(plain: string): string {
  if (plain.length <= 4) return "••••";
  return `••••••••${plain.slice(-4)}`;
}
