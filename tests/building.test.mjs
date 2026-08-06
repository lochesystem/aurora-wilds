import assert from "node:assert/strict";
import test from "node:test";
import { BUILDING_PIECES, canBuild, footprintsOverlap, snapToGrid } from "../app/game/building.js";
import { normalizeSave, SAVE_VERSION } from "../app/game/save-game.js";

test("o catálogo contém as peças do primeiro abrigo",()=>{
  assert.deepEqual(BUILDING_PIECES.map(piece=>piece.id),["foundation","wall","door","roof","chest","bed"]);
  assert.equal(canBuild(BUILDING_PIECES[0],{wood:3,stone:1}),true);
  assert.equal(snapToGrid(2.61),3);
});

test("a validação de footprint detecta peças sobrepostas",()=>{
  assert.equal(footprintsOverlap({x:0,z:0,width:3,depth:3},{x:2,z:0,width:2,depth:2}),true);
  assert.equal(footprintsOverlap({x:0,z:0,width:1,depth:1},{x:4,z:0,width:1,depth:1}),false);
});

test("o save local rejeita versões desconhecidas e normaliza valores",()=>{
  assert.equal(normalizeSave({version:99}),null);
  const save=normalizeSave({version:SAVE_VERSION,position:{x:1,y:2,z:3},health:150,hunger:-2,wood:4.8,structures:[{id:"chest",x:2,y:1,z:4,rotation:0,storage:{wood:3.9,stone:-4}}]});
  assert.equal(save.health,100);assert.equal(save.hunger,0);assert.equal(save.wood,4);
  assert.deepEqual(save.structures[0].storage,{berries:0,wood:3,stone:0});
});
