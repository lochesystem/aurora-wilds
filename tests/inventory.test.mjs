import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_EQUIPMENT, DEFAULT_HOTBAR, assignHotbarItem, normalizeEquipmentSlots, normalizeHotbarSlots, normalizeWeaponSlots, rememberWeapon, setWeaponSlot } from "../app/game/inventory.js";

test("save antigo recebe a barra padrão",()=>{assert.deepEqual(normalizeHotbarSlots(undefined),DEFAULT_HOTBAR);});

test("atribuir item já equipado troca os dois slots sem duplicar",()=>{
  const slots=assignHotbarItem(DEFAULT_HOTBAR,0,"spear");
  assert.equal(slots[0],"spear");assert.equal(slots[8],"hands");assert.equal(new Set(slots).size,9);
});

test("itens do inventário podem ocupar um atalho vazio",()=>{
  const slots=normalizeHotbarSlots(["hands"]);const next=assignHotbarItem(slots,4,"rawMeat");
  assert.equal(next[4],"rawMeat");
});

test("slots de roupa já existem para a progressão térmica",()=>{
  assert.deepEqual(normalizeEquipmentSlots(undefined),DEFAULT_EQUIPMENT);
  assert.deepEqual(Object.keys(DEFAULT_EQUIPMENT),["head","body","legs","feet"]);
});

test("duas ferramentas podem ser carregadas sem duplicação",()=>{
  assert.deepEqual(normalizeWeaponSlots(undefined),["",""]);
  assert.deepEqual(rememberWeapon(["",""],"axe"),["axe",""]);
  assert.deepEqual(rememberWeapon(["axe","pickaxe"],"spear","axe"),["axe","spear"]);
  assert.deepEqual(setWeaponSlot(["axe","pickaxe"],0,"pickaxe"),["pickaxe","axe"]);
});
