import assert from "node:assert/strict";
import test from "node:test";
import { BUILDING_PIECES, buildingPlacementBlocked, canBuild, findBuildingSnap, footprintsOverlap, isStructureSupported, snapToGrid, structureRefund, structureRepairCost, unsupportedStructuresAfterRemoval } from "../app/game/building.js";
import { normalizeSave, SAVE_VERSION } from "../app/game/save-game.js";

test("o catálogo contém as peças do primeiro abrigo",()=>{
  assert.deepEqual(BUILDING_PIECES.map(piece=>piece.id),["foundation","wall","door","roof","slopedRoof","stairs","ramp","chest","bed"]);
  assert.equal(canBuild(BUILDING_PIECES[0],{wood:3,stone:1}),true);
  assert.equal(snapToGrid(2.61),3);
});

test("estruturas têm vida, reparo, reembolso e sustentação",()=>{
  const foundation=BUILDING_PIECES[0],wall=BUILDING_PIECES[1];
  assert.deepEqual(structureRefund(foundation),{wood:1,stone:0});
  assert.deepEqual(structureRepairCost(wall,60),{wood:1,stone:0});
  const base={id:"foundation",x:0,y:0,z:0,rotation:0},supported={id:"wall",x:0,y:.28,z:1.5,rotation:0};
  assert.equal(isStructureSupported(supported,[base]),true);
  assert.deepEqual(unsupportedStructuresAfterRemoval(base,[base,supported]),[supported]);
  const roofA={id:"roof",x:0,y:.33,z:0,rotation:0},roofB={id:"roof",x:3,y:.33,z:0,rotation:0};
  assert.deepEqual(unsupportedStructuresAfterRemoval(base,[base,supported,roofA,roofB]),[supported,roofA,roofB]);
});

test("a validação de footprint detecta peças sobrepostas",()=>{
  assert.equal(footprintsOverlap({x:0,z:0,width:3,depth:3},{x:2,z:0,width:2,depth:2}),true);
  assert.equal(footprintsOverlap({x:0,z:0,width:1,depth:1},{x:4,z:0,width:1,depth:1}),false);
});

test("fundações encaixam no módulo apontado sem sobrepor",()=>{
  const structures=[{id:"foundation",x:0,y:1,z:0,rotation:0}];
  const snap=findBuildingSnap("foundation",{x:3.2,y:0,z:.1,rotation:0},structures);
  assert.deepEqual(snap,{x:3,y:1,z:0,rotation:0,kind:"foundation-side",label:"Fundação conectada"});
  assert.equal(buildingPlacementBlocked({id:"foundation",x:3,y:1,z:0,rotation:0},structures),false);
  assert.equal(buildingPlacementBlocked({id:"foundation",x:0,y:1,z:0,rotation:0},structures),true);
});

test("paredes encaixam nas bordas da fundação e podem ser empilhadas",()=>{
  const foundation=[{id:"foundation",x:0,y:2,z:0,rotation:0}];
  const edge=findBuildingSnap("wall",{x:.1,y:2,z:1.7,rotation:0},foundation);
  assert.equal(edge.kind,"foundation-edge");
  assert.deepEqual([edge.x,edge.z,edge.rotation],[0,1.5,0]);
  assert.ok(Math.abs(edge.y-2.28)<1e-9);

  const walls=[{id:"wall",x:0,y:2.28,z:1.5,rotation:0}];
  const stacked=findBuildingSnap("wall",{x:.1,y:2,z:1.45,rotation:0},walls);
  assert.equal(stacked.kind,"wall-top");
  assert.ok(Math.abs(stacked.y-4.98)<1e-9);
  const extended=findBuildingSnap("wall",{x:3.1,y:2,z:1.5,rotation:0},walls);
  assert.equal(extended.kind,"wall-side");
  assert.equal(extended.x,3);
});

test("telhados encaixam acima de paredes simples ou duplas",()=>{
  const upperWall=[{id:"wall",x:0,y:2.98,z:1.5,rotation:0}];
  const roof=findBuildingSnap("roof",{x:0,y:0,z:.1,rotation:0},upperWall);
  assert.equal(roof.kind,"roof-top");
  assert.deepEqual([roof.x,roof.y,roof.z],[0,3.03,0]);
});

test("telhados conectados compartilham o beiral sem serem bloqueados",()=>{
  const roofs=[{id:"roof",x:0,y:.33,z:0,rotation:0}];
  const snap=findBuildingSnap("roof",{x:3.1,y:.33,z:.1,rotation:0},roofs);
  assert.equal(snap.kind,"roof-side");
  assert.deepEqual([snap.x,snap.y,snap.z],[3,.33,0]);
  assert.equal(buildingPlacementBlocked({id:"roof",x:3,y:.33,z:0,rotation:0},roofs),false);
  assert.equal(buildingPlacementBlocked({id:"roof",x:0,y:.33,z:0,rotation:0},roofs),true);
});

test("encaixe com telhado prevalece quando fundação e telhado oferecem o mesmo ponto",()=>{
  const structures=[
    {id:"foundation",x:3,y:0,z:0,rotation:0},
    {id:"roof",x:0,y:.33,z:0,rotation:0},
  ];
  const snap=findBuildingSnap("roof",{x:3.1,y:0,z:0,rotation:0},structures);
  assert.equal(snap.kind,"roof-side");
  assert.equal(snap.label,"Telhado conectado");
});

test("posicionamento permanece livre longe de pontos compatíveis",()=>{
  assert.equal(findBuildingSnap("foundation",{x:12,y:0,z:12,rotation:0},[{id:"foundation",x:0,y:0,z:0,rotation:0}]),null);
});

test("escadas e rampas conectam nas laterais de fundações",()=>{
  const foundation=[{id:"foundation",x:0,y:1,z:0,rotation:0}];
  assert.equal(findBuildingSnap("stairs",{x:0,y:1,z:3.1,rotation:0},foundation).kind,"access-side");
  assert.equal(findBuildingSnap("ramp",{x:-3.1,y:1,z:0,rotation:0},foundation).label,"Acesso conectado");
});

test("o save local rejeita versões desconhecidas e normaliza valores",()=>{
  assert.equal(normalizeSave({version:99}),null);
  const save=normalizeSave({version:SAVE_VERSION,position:{x:1,y:2,z:3},health:150,hunger:-2,wood:4.8,structures:[{id:"chest",x:2,y:1,z:4,rotation:0,storage:{wood:3.9,stone:-4}}]});
  assert.equal(save.health,100);assert.equal(save.hunger,0);assert.equal(save.wood,4);
  assert.deepEqual(save.structures[0].storage,{berries:0,wood:3,stone:0});
});
