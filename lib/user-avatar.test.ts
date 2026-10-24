import { describe, expect, it } from "vitest";
import { parseAvatarStore } from "./user-avatar";

describe("avatar guardado en el navegador", () => {
  it("lee los avatares por usuario e ignora valores vacíos o que no son texto", () => {
    expect(
      parseAvatarStore(
        JSON.stringify({ u1: " /a.png ", u2: "", u3: 7, u4: null })
      )
    ).toEqual({ u1: "/a.png" });
  });

  it("un valor roto no rompe la pantalla", () => {
    expect(parseAvatarStore(null)).toEqual({});
    expect(parseAvatarStore("no es json")).toEqual({});
    expect(parseAvatarStore("[1,2]")).toEqual({});
  });
});
