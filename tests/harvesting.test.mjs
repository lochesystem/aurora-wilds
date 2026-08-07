import assert from "node:assert/strict";
import test from "node:test";
import { harvestHit, RESOURCE_HEALTH } from "../app/game/harvesting.js";

test("machado derruba árvore em menos golpes sem alterar o rendimento total",()=>{
  const hands=harvestHit("wood",RESOURCE_HEALTH.wood,"hands");
  const axe=harvestHit("wood",RESOURCE_HEALTH.wood,"axe");
  assert.equal(hands.damage,1);assert.equal(axe.damage,3);
  assert.equal(RESOURCE_HEALTH.wood/hands.damage,6);assert.equal(RESOURCE_HEALTH.wood/axe.damage,2);
});

test("picareta acelera pedra e golpes nunca geram mais que a vida restante",()=>{
  const pickaxe=harvestHit("stone",2,"pickaxe");
  assert.deepEqual(pickaxe,{damage:2,drop:2,remaining:0,destroyed:true,durabilityCost:5,strongTool:true});
});
