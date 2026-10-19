import { describe, expect, it } from "vitest";
import {
  IDLE_LOGOUT_DEFAULT_MS,
  IDLE_LOGOUT_MIN_MS,
  resolveIdleLogoutTimeoutMs,
} from "./use-idle-logout";

const MINUTE = 60 * 1000;

describe("tiempo de cierre por inactividad (minimo 10 minutos, decision del 2026-10-19)", () => {
  it("sin configurar, son 20 minutos", () => {
    expect(resolveIdleLogoutTimeoutMs(undefined)).toBe(20 * MINUTE);
    expect(IDLE_LOGOUT_DEFAULT_MS).toBe(20 * MINUTE);
  });

  it("un valor menor a 10 minutos sube a 10, como los 2 minutos de prueba que quedaron en .env.local", () => {
    expect(resolveIdleLogoutTimeoutMs("120000")).toBe(10 * MINUTE);
    expect(resolveIdleLogoutTimeoutMs("1")).toBe(IDLE_LOGOUT_MIN_MS);
  });

  it("10 minutos o mas se respetan", () => {
    expect(resolveIdleLogoutTimeoutMs(String(10 * MINUTE))).toBe(10 * MINUTE);
    expect(resolveIdleLogoutTimeoutMs(String(45 * MINUTE))).toBe(45 * MINUTE);
  });

  it("un valor invalido, cero o negativo usa los 20 minutos por defecto", () => {
    for (const value of ["", "abc", "0", "-5"]) {
      expect(resolveIdleLogoutTimeoutMs(value)).toBe(20 * MINUTE);
    }
  });
});
