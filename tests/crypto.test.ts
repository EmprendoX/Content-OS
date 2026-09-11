import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/security/crypto";

describe("cifrado local de tokens", () => {
  it("cifra y descifra (AES-256-GCM)", () => {
    const token = "token-secreto-123";
    const encrypted = encryptSecret(token);
    expect(encrypted).not.toContain(token);
    expect(encrypted.split(".")).toHaveLength(3);
    expect(decryptSecret(encrypted)).toBe(token);
  });

  it("dos cifrados del mismo valor son distintos (IV aleatorio)", () => {
    expect(encryptSecret("abc")).not.toBe(encryptSecret("abc"));
  });

  it("detecta manipulación", () => {
    const encrypted = encryptSecret("abc");
    const [iv, tag, data] = encrypted.split(".");
    const tampered = `${iv}.${tag}.${data.slice(0, -2)}AA`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("enmascara para la interfaz", () => {
    expect(maskSecret("abcdefgh")).toBe("••••••••efgh");
    expect(maskSecret("ab")).toBe("••••");
  });
});
