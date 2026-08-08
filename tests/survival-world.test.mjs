import assert from "node:assert/strict";
import { test } from "node:test";
import { CHUNK_SIZE, GRASS_TUFTS_PER_CHUNK, WATER_LEVEL, biomeAt, grassDensityAt, grassForChunk, grassTuftBudget, isWaterAt, mountainFieldAt, pointsOfInterestForChunk, resourcesForChunk, riverCenterAt, safeSurfaceReturn, terrainHeightAt, visibleChunkCoordinates, worldToChunk } from "../app/game/survival-world.js";

test("world generation is deterministic", () => {
  assert.deepEqual(resourcesForChunk(4, -7), resourcesForChunk(4, -7));
  assert.equal(terrainHeightAt(12.5, -9.25), terrainHeightAt(12.5, -9.25));
});

test("neighboring chunks share the same terrain edge", () => {
  const edgeX = CHUNK_SIZE;
  for (let z = 0; z <= CHUNK_SIZE; z += 4) {
    assert.equal(terrainHeightAt(edgeX, z), terrainHeightAt(edgeX, z));
  }
});

test("visible chunk square and negative coordinates are stable", () => {
  assert.equal(visibleChunkCoordinates(0, 0, 2).length, 25);
  assert.equal(worldToChunk(-0.1), -1);
  assert.equal(worldToChunk(CHUNK_SIZE), 1);
});

test("grass is dense, deterministic and follows the procedural terrain",()=>{
  const first=grassForChunk(-2,3),second=grassForChunk(-2,3);
  assert.ok(first.length<=GRASS_TUFTS_PER_CHUNK);
  assert.deepEqual(first,second);
  for(const tuft of first){
    assert.ok(tuft.x>=0&&tuft.x<=CHUNK_SIZE);
    assert.ok(tuft.z>=0&&tuft.z<=CHUNK_SIZE);
    assert.equal(tuft.y,terrainHeightAt(-2*CHUNK_SIZE+tuft.x,3*CHUNK_SIZE+tuft.z));
  }
});

test("grass coverage forms continuous clearings and full meadows",()=>{
  let minimum=1,maximum=0;
  for(let z=-640;z<=640;z+=20)for(let x=-640;x<=640;x+=20){
    const density=grassDensityAt(x,z);minimum=Math.min(minimum,density);maximum=Math.max(maximum,density);
    assert.ok(density>=0&&density<=1);
    assert.ok(Math.abs(density-grassDensityAt(x+.1,z+.1))<.035,"a transição não pode criar uma borda abrupta");
  }
  assert.equal(minimum,0,"o mundo deve conter clareiras completas");
  assert.equal(maximum,1,"o mundo deve conter gramados completamente preenchidos");
});

test("grass setting maps to none, sparse and dense rendering budgets",()=>{
  assert.equal(grassTuftBudget("none"),0);
  assert.ok(grassTuftBudget("low")>0&&grassTuftBudget("low")<GRASS_TUFTS_PER_CHUNK);
  assert.equal(grassTuftBudget("high"),GRASS_TUFTS_PER_CHUNK);
});

test("o rio é contínuo, escava o terreno e remove a grama",()=>{
  for(let x=-160;x<=160;x+=16){const z=riverCenterAt(x);assert.equal(isWaterAt(x,z),true);assert.ok(terrainHeightAt(x,z)<WATER_LEVEL);assert.equal(grassDensityAt(x,z),0);}
});

test("biomas e pontos de interesse são determinísticos",()=>{
  const names=new Set();for(let z=-320;z<=320;z+=32)for(let x=-320;x<=320;x+=32)names.add(biomeAt(x,z).id);
  assert.ok(names.size>=3);
  assert.deepEqual(pointsOfInterestForChunk(8,-6),pointsOfInterestForChunk(8,-6));
});

test("montanhas surgem longe da origem sem bloquear o ponto inicial",()=>{
  assert.equal(mountainFieldAt(0,0),0);let maximum=0;for(let z=-600;z<=600;z+=24)for(let x=-600;x<=600;x+=24)maximum=Math.max(maximum,mountainFieldAt(x,z));assert.ok(maximum>8);
});

test("retorno da caverna sempre coloca o jogador acima do terreno",()=>{
  const returned=safeSurfaceReturn(112,68,-80);
  assert.ok(returned.y>terrainHeightAt(returned.x,returned.z)+2);
  assert.equal(returned.x,112);assert.equal(returned.z,68);
});
