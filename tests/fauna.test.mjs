import assert from "node:assert/strict";
import test from "node:test";
import { FAUNA_STATS, faunaForChunk, faunaHitDamage, faunaIntent } from "../app/game/fauna.js";

test("fauna procedural é determinística e protege a origem de predadores",()=>{
  assert.deepEqual(faunaForChunk(0,0),faunaForChunk(0,0));
  assert.ok(faunaForChunk(0,0).some(animal=>animal.kind==="grazer"));
  assert.equal(faunaForChunk(0,0).some(animal=>animal.kind==="predator"),false);
});

test("herbívoros fogem e predadores perseguem ou atacam",()=>{
  assert.equal(faunaIntent("grazer",5),"flee");
  assert.equal(faunaIntent("grazer",10),"wander");
  assert.equal(faunaIntent("predator",8),"chase");
  assert.equal(faunaIntent("predator",1),"attack");
});

test("a lança é a melhor arma inicial para caça",()=>{
  assert.ok(faunaHitDamage("spear",1)>faunaHitDamage("axe",1));
  assert.ok(faunaHitDamage("spear",3)>faunaHitDamage("spear",1));
  assert.equal(FAUNA_STATS.predator.damage,11);
});
