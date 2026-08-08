import assert from "node:assert/strict";
import test from "node:test";
import { FAUNA_STATS, faunaCanAct, faunaForChunk, faunaHitDamage, faunaIntent, nightEventFor } from "../app/game/fauna.js";

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
  assert.equal(faunaIntent("boar",5),"flee");
  assert.equal(faunaIntent("bear",8),"chase");
  assert.equal(faunaIntent("golem",12),"chase");
});

test("eventos noturnos aumentam o perigo em ciclos previsíveis",()=>{
  assert.equal(nightEventFor(2).id,"pack");
  assert.equal(nightEventFor(3).id,"bloodMoon");
  assert.ok(nightEventFor(3).dangerMultiplier>nightEventFor(1).dangerMultiplier);
});

test("a lança é a melhor arma inicial para caça",()=>{
  assert.ok(faunaHitDamage("spear",1)>faunaHitDamage("axe",1));
  assert.ok(faunaHitDamage("spear",3)>faunaHitDamage("spear",1));
  assert.equal(FAUNA_STATS.predator.damage,11);
});

test("animal derrotado ou invisível nunca continua atacando",()=>{
  assert.equal(faunaCanAct({visible:true,health:12,deadTimer:0}),true);
  assert.equal(faunaCanAct({visible:true,health:0,deadTimer:0}),false);
  assert.equal(faunaCanAct({visible:false,health:12,deadTimer:0}),false);
  assert.equal(faunaCanAct({visible:true,health:0,deadTimer:.4}),false);
});
