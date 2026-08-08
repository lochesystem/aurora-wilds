export const WORLD_SEED = 834_221;
export const CHUNK_SIZE = 32;
export const CHUNK_SEGMENTS = 12;
export const CHUNK_LOAD_RADIUS = 2;
export const GRASS_TUFTS_PER_CHUNK = 1600;
export const WATER_LEVEL=-1.25;

export function grassTuftBudget(amount){
  if(amount==="none")return 0;
  if(amount==="low")return 480;
  return GRASS_TUFTS_PER_CHUNK;
}

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

export function riverCenterAt(x){return 48+Math.sin(x*.018)*19+Math.sin(x*.006+1.7)*11;}
export function riverDistanceAt(x,z){return Math.abs(z-riverCenterAt(x));}
export function isWaterAt(x,z){return riverDistanceAt(x,z)<3.2;}

export function mountainFieldAt(x,z){
  const distanceFade=smoothstep(Math.max(0,Math.min(1,(Math.hypot(x,z)-42)/90)));
  const ridge=valueNoise(x-120,z+85,118,2243)*.68+valueNoise(x+33,z-17,47,2297)*.32;
  const peak=Math.max(0,(ridge-.54)/.46);return peak*peak*19*distanceFade;
}

export function terrainHeightAt(x, z) {
  const broad = (valueNoise(x, z, 52, 11) - 0.5) * 7;
  const detail = (valueNoise(x, z, 19, 29) - 0.5) * 2.2;
  const ridges = Math.sin(x * 0.045) * Math.cos(z * 0.038) * 1.25;
  const natural=broad+detail+ridges+mountainFieldAt(x,z),distance=riverDistanceAt(x,z);
  const bank=smoothstep(Math.max(0,Math.min(1,(distance-2.6)/5.2)));
  return (WATER_LEVEL-1.1)*(1-bank)+natural*bank;
}

export function safeSurfaceReturn(x,z,savedY){
  return{x,z,y:Math.max(terrainHeightAt(x,z)+2.4,Number.isFinite(savedY)?savedY:0)};
}

export function biomeAt(x,z){
  if(riverDistanceAt(x,z)<7)return{id:"riverlands",name:"Margens Luminosas",resourceBias:"berry",danger:1.1};
  const height=terrainHeightAt(x,z),forest=valueNoise(x+71,z-43,76,1711);
  if(height>4.2||mountainFieldAt(x,z)>3)return{id:"highlands",name:"Serra de Pedra",resourceBias:"stone",danger:1.3};
  if(forest>.61)return{id:"forest",name:"Bosque Verdejante",resourceBias:"wood",danger:1.2};
  return{id:"meadows",name:"Campos de Aurora",resourceBias:"mixed",danger:1};
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
    const x = chunkX * CHUNK_SIZE + 2.5 + randomX * (CHUNK_SIZE - 5);
    const z = chunkZ * CHUNK_SIZE + 2.5 + randomZ * (CHUNK_SIZE - 5);
    if(isWaterAt(x,z))continue;
    const kindRoll = hash2D(chunkX * 7 + index, chunkZ * 11 + index, WORLD_SEED + 401),biome=biomeAt(x,z);
    const kind = biome.resourceBias==="wood"?(kindRoll<.58?"wood":kindRoll<.78?"berry":"stone"):biome.resourceBias==="stone"?(kindRoll<.56?"stone":kindRoll<.78?"wood":"berry"):biome.resourceBias==="berry"?(kindRoll<.54?"berry":kindRoll<.77?"wood":"stone"):(kindRoll < 0.36 ? "berry" : kindRoll < 0.72 ? "wood" : "stone");
    resources.push({ id: `${chunkKey(chunkX, chunkZ)}:${index}`, kind, x, y: terrainHeightAt(x, z), z, scale: 0.82 + hash2D(index, chunkX - chunkZ, WORLD_SEED + 503) * 0.42 });
  }
  return resources;
}

export function grassDensityAt(x,z){
  if(isWaterAt(x,z))return 0;
  const broad=valueNoise(x,z,92,1379);
  const detail=valueNoise(x+19,z-31,38,1487);
  const field=broad*.74+detail*.26;
  const transition=Math.max(0,Math.min(1,(field-.35)/.3));
  return smoothstep(transition);
}

export function pointsOfInterestForChunk(chunkX,chunkZ){
  if(Math.abs(chunkX)<=1&&Math.abs(chunkZ)<=1)return[];
  if(hash2D(chunkX,chunkZ,WORLD_SEED+1901)<.68)return[];
  const roll=hash2D(chunkX*17,chunkZ*23,WORLD_SEED+1999),chunkBiome=biomeAt((chunkX+.5)*CHUNK_SIZE,(chunkZ+.5)*CHUNK_SIZE),type=chunkBiome.id==="highlands"&&roll<.62?"cave":roll<.34?"ruin":roll<.67?"cave":"camp";
  const x=chunkX*CHUNK_SIZE+7+hash2D(chunkX*29,chunkZ*31,WORLD_SEED+2017)*(CHUNK_SIZE-14);
  let z=chunkZ*CHUNK_SIZE+7+hash2D(chunkX*37,chunkZ*41,WORLD_SEED+2081)*(CHUNK_SIZE-14);
  if(isWaterAt(x,z))z+=z<riverCenterAt(x)?-7:7;
  return[{id:`poi:${chunkX}:${chunkZ}:${type}`,type,x,z,y:terrainHeightAt(x,z),reward:type==="ruin"?{wood:3,stone:5,berries:1}:type==="cave"?{wood:1,stone:7,berries:0}:{wood:5,stone:2,berries:4}}];
}

export function grassForChunk(chunkX,chunkZ,count=GRASS_TUFTS_PER_CHUNK){
  const grass=[];
  const gridSize=Math.ceil(Math.sqrt(count));
  for(let index=0;index<count;index+=1){
    const cellX=index%gridSize,cellZ=Math.floor(index/gridSize);
    const jitterX=.12+hash2D(chunkX*977+index,chunkZ*431-index,WORLD_SEED+701)*.76;
    const jitterZ=.12+hash2D(chunkX*593-index,chunkZ*857+index,WORLD_SEED+809)*.76;
    const localX=(cellX+jitterX)/gridSize*CHUNK_SIZE;
    const localZ=(cellZ+jitterZ)/gridSize*CHUNK_SIZE;
    const worldX=chunkX*CHUNK_SIZE+localX,worldZ=chunkZ*CHUNK_SIZE+localZ;
    const variation=hash2D(index+chunkX*37,index-chunkZ*41,WORLD_SEED+907);
    const density=grassDensityAt(worldX,worldZ);
    const presence=hash2D(index*11+chunkX*73,index*17-chunkZ*61,WORLD_SEED+1303);
    if(presence>density)continue;
    grass.push({
      x:localX,y:terrainHeightAt(worldX,worldZ),z:localZ,
      rotation:variation*Math.PI*2,
      height:.48+hash2D(index,chunkX+chunkZ,WORLD_SEED+1009)*.48,
      width:.78+hash2D(chunkX-index,chunkZ+index,WORLD_SEED+1103)*.55,
      tint:hash2D(index*3+chunkX,index*5+chunkZ,WORLD_SEED+1201),
    });
  }
  return grass;
}
