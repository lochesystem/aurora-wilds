import * as THREE from "three";
import { applyWind, PALETTE, setWindWeight } from "./art";

export type FoliageAssets = ReturnType<typeof createFoliageAssets>;
export type TreeVariant = "broadleaf" | "pine" | "slim";

/** Ruído determinístico a partir de uma string (id do recurso no chunk). */
export function seededRandom(seed: string) {
  let state = 2_166_136_261;
  for (let index = 0; index < seed.length; index += 1) {
    state ^= seed.charCodeAt(index);
    state = Math.imul(state, 16_777_619);
  }
  return () => {
    state = Math.imul(state ^ (state >>> 15), 2_246_822_507);
    state = Math.imul(state ^ (state >>> 13), 3_266_489_909);
    return ((state ^= state >>> 16) >>> 0) / 4_294_967_296;
  };
}

export function treeVariantFor(value: number): TreeVariant {
  return value < 0.62 ? "broadleaf" : value < 0.88 ? "pine" : "slim";
}

/**
 * `MeshToonMaterial` não expõe `flatShading`, então o facetado vem da própria
 * geometria: sem índices, cada triângulo ganha a sua normal.
 */
function faceted(geometry: THREE.BufferGeometry) {
  const flat = geometry.toNonIndexed();
  geometry.dispose();
  flat.computeVertexNormals();
  return flat;
}

/**
 * Deforma um poliedro para tirar a regularidade da geometria base. Sem isso as
 * rochas ficam com cara de dado e a copa vira uma esfera óbvia.
 */
function jitter(geometry: THREE.BufferGeometry, amount: number, seed: number) {
  const flat = faceted(geometry);
  const position = flat.getAttribute("position") as THREE.BufferAttribute;
  const random = seededRandom(`jitter-${seed}`);
  const moved = new Map<string, [number, number, number]>();
  for (let index = 0; index < position.count; index += 1) {
    // Vértices coincidentes precisam do mesmo deslocamento, senão a malha abre.
    const key = `${position.getX(index).toFixed(3)}|${position.getY(index).toFixed(3)}|${position.getZ(index).toFixed(3)}`;
    let target = moved.get(key);
    if (!target) {
      const scale = 1 + (random() - 0.5) * amount;
      target = [position.getX(index) * scale, position.getY(index) * scale, position.getZ(index) * scale];
      moved.set(key, target);
    }
    position.setXYZ(index, target[0], target[1], target[2]);
  }
  position.needsUpdate = true;
  flat.computeVertexNormals();
  return flat;
}

export function createFoliageAssets(gradientMap: THREE.Texture) {
  const toon = (color: number) => new THREE.MeshToonMaterial({ color, gradientMap });

  const leaf = [toon(PALETTE.leafLight), toon(PALETTE.leafMid), toon(PALETTE.leafDeep)];
  const pine = [toon(PALETTE.pine), toon(0x356a49)];
  const bush = toon(0x5f9a4b);
  const windMaterials = [...leaf, ...pine, bush];
  windMaterials.forEach((material, index) => applyWind(material, index === windMaterials.length - 1 ? 0.09 : 0.16, `aurora-foliage-wind-${index}`));

  const materials = {
    bark: toon(PALETTE.bark),
    barkShade: toon(PALETTE.barkShade),
    leaf,
    pine,
    bush,
    berry: new THREE.MeshToonMaterial({ color: 0xff7a4d, gradientMap, emissive: 0x521a0c, emissiveIntensity: 0.35 }),
    rock: toon(PALETTE.rock),
    rockShade: toon(PALETTE.rockShade),
    moss: toon(PALETTE.moss),
    wind: windMaterials as THREE.Material[],
  };

  const geometries = {
    trunk: setWindWeight(faceted(new THREE.CylinderGeometry(0.22, 0.4, 1, 7, 1)), 0.18),
    trunkSlim: setWindWeight(faceted(new THREE.CylinderGeometry(0.13, 0.2, 1, 6, 1)), 0.3),
    root: setWindWeight(faceted(new THREE.ConeGeometry(0.62, 0.7, 7)), 0),
    branch: setWindWeight(faceted(new THREE.CylinderGeometry(0.06, 0.11, 1, 5)), 0.45),
    canopy: [
      setWindWeight(jitter(new THREE.IcosahedronGeometry(1, 1), 0.3, 1), 1),
      setWindWeight(jitter(new THREE.IcosahedronGeometry(1, 1), 0.34, 2), 1),
      setWindWeight(jitter(new THREE.DodecahedronGeometry(1, 1), 0.28, 3), 1),
    ],
    pineTier: setWindWeight(faceted(new THREE.ConeGeometry(1, 1.15, 8)), 1),
    bush: setWindWeight(jitter(new THREE.IcosahedronGeometry(1, 1), 0.26, 4), 1),
    berry: new THREE.SphereGeometry(0.1, 7, 5),
    boulder: [
      jitter(new THREE.DodecahedronGeometry(1, 0), 0.42, 5),
      jitter(new THREE.IcosahedronGeometry(1, 0), 0.46, 6),
      jitter(new THREE.DodecahedronGeometry(1, 1), 0.3, 7),
    ],
    moss: new THREE.SphereGeometry(1, 9, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
  };

  return { materials, geometries, gradientMap };
}

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, receive = false) {
  const object = new THREE.Mesh(geometry, material);
  object.castShadow = true;
  object.receiveShadow = receive;
  return object;
}

export function createTree(assets: FoliageAssets, variant: TreeVariant, random: () => number) {
  const { geometries, materials } = assets;
  const pivot = new THREE.Group();
  // A inclinação vive num nó interno porque o engine zera a rotação do objeto
  // de recurso ao encerrar a animação de golpe.
  const group = new THREE.Group();
  group.rotation.z = (random() - 0.5) * 0.12;
  group.rotation.y = random() * Math.PI * 2;
  pivot.add(group);

  if (variant === "pine") {
    const height = 3.6 + random() * 1.8;
    const trunk = mesh(geometries.trunkSlim, materials.barkShade);
    trunk.scale.set(1, height * 0.55, 1);
    trunk.position.y = height * 0.275;
    group.add(trunk);
    const tiers = 4 + Math.floor(random() * 2);
    for (let index = 0; index < tiers; index += 1) {
      const progress = index / (tiers - 1);
      const tier = mesh(geometries.pineTier, materials.pine[index % 2]);
      const spread = 1.42 - progress * 0.92;
      tier.scale.set(spread, 1.05 + random() * 0.3, spread);
      tier.position.y = height * (0.32 + progress * 0.62);
      tier.rotation.y = random() * Math.PI;
      group.add(tier);
    }
    return pivot;
  }

  const slim = variant === "slim";
  const height = slim ? 3.6 + random() * 1.2 : 2.9 + random() * 1.3;
  const trunk = mesh(slim ? geometries.trunkSlim : geometries.trunk, materials.bark);
  trunk.scale.set(1, height, 1);
  trunk.position.y = height * 0.5;
  group.add(trunk);

  const root = mesh(geometries.root, materials.barkShade, true);
  root.scale.set(slim ? 0.52 : 0.78, 0.62, slim ? 0.52 : 0.78);
  root.position.y = 0.2;
  group.add(root);

  // Copa em blocos sobrepostos: um domo claro no topo e blocos médios/escuros
  // por baixo criam a silhueta em degraus típica das árvores do BotW.
  const blobs = slim ? 3 : 4 + Math.floor(random() * 2);
  const canopyRadius = slim ? 0.86 : 1.28 + random() * 0.34;
  for (let index = 0; index < blobs; index += 1) {
    const angle = (index / blobs) * Math.PI * 2 + random() * 0.5;
    const drop = index === 0 ? 0 : 0.28 + random() * 0.34;
    const blob = mesh(geometries.canopy[index % geometries.canopy.length], materials.leaf[index === 0 ? 0 : 1 + (index % 2)], true);
    const size = canopyRadius * (index === 0 ? 1 : 0.62 + random() * 0.3);
    blob.scale.set(size, size * (0.72 + random() * 0.2), size);
    blob.position.set(
      index === 0 ? 0 : Math.cos(angle) * canopyRadius * 0.72,
      height + canopyRadius * 0.42 - drop,
      index === 0 ? 0 : Math.sin(angle) * canopyRadius * 0.72,
    );
    group.add(blob);
  }

  if (!slim && random() > 0.45) {
    const branch = mesh(geometries.branch, materials.barkShade);
    const angle = random() * Math.PI * 2;
    branch.scale.set(1, 0.9 + random() * 0.4, 1);
    branch.position.set(Math.cos(angle) * 0.28, height * 0.72, Math.sin(angle) * 0.28);
    branch.rotation.set(Math.sin(angle) * 0.7, 0, -Math.cos(angle) * 0.7);
    group.add(branch);
  }
  return pivot;
}

export function createBerryBush(assets: FoliageAssets, random: () => number) {
  const { geometries, materials } = assets;
  const group = new THREE.Group();
  const clusters = 2 + Math.floor(random() * 2);
  for (let index = 0; index < clusters; index += 1) {
    const blob = mesh(geometries.bush, materials.bush, true);
    const size = index === 0 ? 0.68 + random() * 0.16 : 0.4 + random() * 0.2;
    const angle = random() * Math.PI * 2;
    blob.scale.set(size, size * 0.76, size);
    blob.position.set(index === 0 ? 0 : Math.cos(angle) * 0.44, size * 0.62, index === 0 ? 0 : Math.sin(angle) * 0.44);
    group.add(blob);
  }
  const berries = 5 + Math.floor(random() * 3);
  for (let index = 0; index < berries; index += 1) {
    const berry = new THREE.Mesh(geometries.berry, materials.berry);
    const angle = (index / berries) * Math.PI * 2 + random() * 0.4;
    const radius = 0.42 + random() * 0.16;
    berry.position.set(Math.cos(angle) * radius, 0.44 + random() * 0.42, Math.sin(angle) * radius);
    group.add(berry);
  }
  return group;
}

export function createRock(assets: FoliageAssets, random: () => number) {
  const { geometries, materials } = assets;
  const group = new THREE.Group();
  const main = mesh(geometries.boulder[Math.floor(random() * geometries.boulder.length)], materials.rock, true);
  const width = 0.62 + random() * 0.3;
  const tall = 0.44 + random() * 0.28;
  main.scale.set(width, tall, width * (0.82 + random() * 0.3));
  main.position.y = tall * 0.82;
  main.rotation.set(random() * 0.3, random() * Math.PI, random() * 0.24);
  group.add(main);

  const shard = mesh(geometries.boulder[Math.floor(random() * geometries.boulder.length)], materials.rockShade, true);
  const shardSize = 0.24 + random() * 0.18;
  const shardAngle = random() * Math.PI * 2;
  shard.scale.set(shardSize, shardSize * 0.82, shardSize);
  shard.position.set(Math.cos(shardAngle) * (width * 0.9), shardSize * 0.6, Math.sin(shardAngle) * (width * 0.9));
  shard.rotation.set(random(), random() * Math.PI, random());
  group.add(shard);

  if (random() > 0.35) {
    const moss = new THREE.Mesh(geometries.moss, materials.moss);
    moss.scale.set(width * 0.82, tall * 0.34, width * 0.78);
    moss.position.y = tall * 1.28;
    moss.rotation.y = random() * Math.PI;
    moss.receiveShadow = true;
    group.add(moss);
  }
  return group;
}

export function disposeFoliageAssets(assets: FoliageAssets) {
  const { geometries, materials } = assets;
  const collect = (value: unknown): Array<THREE.BufferGeometry | THREE.Material> =>
    Array.isArray(value) ? value.flatMap(collect) : value instanceof THREE.BufferGeometry || value instanceof THREE.Material ? [value] : [];
  for (const value of [...Object.values(geometries), ...Object.values(materials)]) collect(value).forEach(item => item.dispose());
  assets.gradientMap.dispose();
}
