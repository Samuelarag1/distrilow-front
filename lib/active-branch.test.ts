import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Module-level state, same as api-client.ts: a fresh instance per test.
async function freshActiveBranch() {
  vi.resetModules();
  return import("./active-branch");
}

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => Array.from(data.keys())[index] ?? null,
    removeItem: (key) => {
      data.delete(key);
    },
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

const A = { id: "branch-A" };
const B = { id: "branch-B" };

describe("active-branch — sucursal activa (docs/design/01-login-y-sesion.md §12.4)", () => {
  let localStorage: Storage;

  // Each test simulates one tab; `localStorage` is shared across "tabs" by
  // keeping the same instance, `sessionStorage` is new per tab.
  function openTab() {
    vi.stubGlobal("window", { localStorage, sessionStorage: memoryStorage() });
  }

  beforeEach(() => {
    localStorage = memoryStorage();
    openTab();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("selectBranch rechaza una sucursal a la que el usuario no tiene acceso", async () => {
    const store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A] });

    expect(() => store.selectBranch("branch-ajena")).toThrow();
    expect(store.getActiveBranchId()).toBe("branch-A");
  });

  it("sin eleccion previa usa el default del servidor, nunca la primera de la lista", async () => {
    const store = await freshActiveBranch();

    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: "branch-B" });
    expect(store.getActiveBranchId()).toBe("branch-B");
  });

  it("sin eleccion previa ni default, queda sin sucursal", async () => {
    const store = await freshActiveBranch();

    store.reconcileActiveBranch({ userId: "u", branches: [A, B] });
    expect(store.getActiveBranchId()).toBeNull();
  });

  it("una pestana nueva arranca con la ultima sucursal que abrio el usuario (D7)", async () => {
    let store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: "branch-A" });
    store.selectBranch("branch-B");

    openTab();
    store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: "branch-A" });

    expect(store.getActiveBranchId()).toBe("branch-B");
  });

  it("cambiar de sucursal en una pestana no cambia la de otra ya abierta (SUC-07)", async () => {
    // Pestana 1 en A.
    const tab1Session = memoryStorage();
    vi.stubGlobal("window", { localStorage, sessionStorage: tab1Session });
    let store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B] });
    store.selectBranch("branch-A");

    // Pestana 2 elige B.
    openTab();
    store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B] });
    store.selectBranch("branch-B");

    // Pestana 1 recarga: sigue en A.
    vi.stubGlobal("window", { localStorage, sessionStorage: tab1Session });
    store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B] });

    expect(store.getActiveBranchId()).toBe("branch-A");
  });

  it("la ultima sucursal usada es por usuario: otro usuario no la hereda", async () => {
    let store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "ana", branches: [A, B] });
    store.selectBranch("branch-B");

    openTab();
    store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "beto", branches: [A, B], serverDefaultBranchId: "branch-A" });

    expect(store.getActiveBranchId()).toBe("branch-A");
  });

  it("notifica a los suscriptores solo cuando la sucursal cambia", async () => {
    const store = await freshActiveBranch();
    const listener = vi.fn();
    store.subscribeActiveBranch(listener);

    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: "branch-A" });
    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: "branch-A" });
    store.selectBranch("branch-B");

    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("clearActiveBranch limpia la pestana pero conserva la ultima usada para el proximo login", async () => {
    let store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B] });
    store.selectBranch("branch-B");
    store.clearActiveBranch();
    expect(store.getActiveBranchId()).toBeNull();

    store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B] });
    expect(store.getActiveBranchId()).toBe("branch-B");
  });
});

describe("active-branch — cambiar de sucursal recarga la pagina (nada de la anterior queda en memoria)", () => {
  let localStorage: Storage;
  let sessionStorage: Storage;

  beforeEach(() => {
    localStorage = memoryStorage();
    sessionStorage = memoryStorage();
    vi.stubGlobal("window", { localStorage, sessionStorage });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  async function loggedInStore(branchId = "branch-A") {
    const store = await freshActiveBranch();
    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: branchId });
    return store;
  }

  it("elegir otra sucursal recarga una vez, y la recarga ya ve la sucursal nueva", async () => {
    const store = await loggedInStore();
    const tabBranchAtReload: (string | null)[] = [];
    store.reloadOnBranchSwitch(() => {
      tabBranchAtReload.push(sessionStorage.getItem("distrilow:activeBranchId"));
    });

    store.selectBranch("branch-B");

    expect(tabBranchAtReload).toEqual(["branch-B"]);
  });

  it("elegir la sucursal en la que ya esta no recarga", async () => {
    const store = await loggedInStore();
    const reload = vi.fn();
    store.reloadOnBranchSwitch(reload);

    store.selectBranch("branch-A");

    expect(reload).not.toHaveBeenCalled();
  });

  it("el login y la carga de la pagina (sin sucursal -> A) no recargan", async () => {
    const store = await freshActiveBranch();
    const reload = vi.fn();
    store.reloadOnBranchSwitch(reload);

    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: "branch-A" });

    expect(store.getActiveBranchId()).toBe("branch-A");
    expect(reload).not.toHaveBeenCalled();
  });

  it("el logout (A -> sin sucursal) no recarga", async () => {
    const store = await loggedInStore();
    const reload = vi.fn();
    store.reloadOnBranchSwitch(reload);

    store.clearActiveBranch();

    expect(reload).not.toHaveBeenCalled();
  });

  it("un refresh que le quita la sucursal activa y cae en otra tambien recarga", async () => {
    const store = await loggedInStore("branch-B");
    store.selectBranch("branch-B");
    const reload = vi.fn();
    store.reloadOnBranchSwitch(reload);

    // Le quitaron B: el refresh trae solo A.
    store.reconcileActiveBranch({ userId: "u", branches: [A], serverDefaultBranchId: "branch-A" });

    expect(store.getActiveBranchId()).toBe("branch-A");
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it("un refresh que mantiene la sucursal no recarga", async () => {
    const store = await loggedInStore();
    const reload = vi.fn();
    store.reloadOnBranchSwitch(reload);

    store.reconcileActiveBranch({ userId: "u", branches: [A, B], serverDefaultBranchId: "branch-B" });

    expect(store.getActiveBranchId()).toBe("branch-A");
    expect(reload).not.toHaveBeenCalled();
  });

  it("al desuscribirse deja de recargar", async () => {
    const store = await loggedInStore();
    const reload = vi.fn();
    const stop = store.reloadOnBranchSwitch(reload);

    stop();
    store.selectBranch("branch-B");

    expect(reload).not.toHaveBeenCalled();
  });
});
