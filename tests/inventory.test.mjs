import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_HOTBAR, assignHotbarItem, normalizeHotbarSlots } from "../app/game/inventory.js";

test("save antigo recebe a barra padrão",()=>{assert.deepEqual(normalizeHotbarSlots(undefined),DEFAULT_HOTBAR);});

test("atribuir item já equipado troca os dois slots sem duplicar",()=>{
  const slots=assignHotbarItem(DEFAULT_HOTBAR,0,"spear");
  assert.equal(slots[0],"spear");assert.equal(slots[8],"hands");assert.equal(new Set(slots).size,9);
});

test("itens do inventário podem ocupar um atalho vazio",()=>{
  const slots=normalizeHotbarSlots(["hands"]);const next=assignHotbarItem(slots,4,"rawMeat");
  assert.equal(next[4],"rawMeat");
});
