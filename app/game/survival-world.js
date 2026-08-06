export const WORLD_SEED = 834_221;
export const CHUNK_SIZE = 32;
export const CHUNK_SEGMENTS = 12;
export const CHUNK_LOAD_RADIUS = 2;

function hash2D(x, z, seed = WORLD_SEED) {
  let value = Math.imul(x, 374_761_393) + Math.imul(z, 668_265_263) + Math.imul(seed, 69069);
  value = Math.imul(value ^ (value >>> 13), 1_274_126_177);
  return ((value ^ (value >>> 16)) >>> 0) / 4_294_967_295;
}

function smoothstep(value) {
  return value * value * (3 - 2 * value);
}

function valueNoise(x, z, scale, seedOffset) {
  const sampleX = x / scale;
  const sampleZ = z / scale;
  const x0 = Math.floor(sampleX);
  const z0 = Math.floor(sampleZ);
  const tx = smoothstep(sampleX - x0);
  const tz = smoothstep(sampleZ - z0);
  const top = hash2D(x0, z0, WORLD_SEED + seedOffset) * (1 - tx) + hash2D(x0 + 1, z0, WORLD_SEED + seedOffset) * tx;
  const bottom = hash2D(x0, z0 + 1, WORLD_SEED + seedOffset) * (1 - tx) + hash2D(x0 + 1, z0 + 1, WORLD_SEED + seedOffset) * tx;
  return top * (1 - tz) + bottom * tz;
}

export function terrainHeightAt(x, z) {
  const broad = (valueNoise(x, z, 52, 11) - 0.5) * 7;
  const detail = (valueNoise(x, z, 19, 29) - 0.5) * 2.2;
  const ridges = Math.sin(x * 0.045) * Math.cos(z * 0.038) * 1.25;
  return broad + detail + ridges;
}

export function chunkKey(chunkX, chunkZ) {
  return `${chunkX}:${chunkZ}`;
}

export function worldToChunk(value) {
  return Math.floor(value / CHUNK_SIZE);
}

export function visibleChunkCoordinates(centerX, centerZ, radius = CHUNK_LOAD_RADIUS) {
  const coordinates = [];
  for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
    for (let x = centerX - radius; x <= centerX + radius; x += 1) coordinates.push({ x, z });
  }
  return coordinates;
}

export function resourcesForChunk(chunkX, chunkZ) {
  const count = 5 + Math.floor(hash2D(chunkX, chunkZ, WORLD_SEED + 101) * 5);
  const resources = [];
  for (let index = 0; index < count; index += 1) {
    const randomX = hash2D(chunkX * 31 + index, chunkZ * 17 - index, WORLD_SEED + 211);
    const randomZ = hash2D(chunkX * 13 - index, chunkZ * 29 + index, WORLD_SEED + 307);
    const kindRoll = hash2D(chunkX * 7 + index, chunkZ * 11 + index, WORLD_SEED + 401);
    const x = chunkX * CHUNK_SIZE + 2.5 + randomX * (CHUNK_SIZE - 5);
    const z = chunkZ * CHUNK_SIZE + 2.5 + randomZ * (CHUNK_SIZE - 5);
    const kind = kindRoll < 0.36 ? "berry" : kindRoll < 0.72 ? "wood" : "stone";
    resources.push({ id: `${chunkKey(chunkX, chunkZ)}:${index}`, kind, x, y: terrainHeightAt(x, z), z, scale: 0.82 + hash2D(index, chunkX - chunkZ, WORLD_SEED + 503) * 0.42 });
  }
  return resources;
}
