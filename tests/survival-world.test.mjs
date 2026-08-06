import assert from "node:assert/strict";
import { test } from "node:test";
import { CHUNK_SIZE, resourcesForChunk, terrainHeightAt, visibleChunkCoordinates, worldToChunk } from "../app/game/survival-world.js";

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
