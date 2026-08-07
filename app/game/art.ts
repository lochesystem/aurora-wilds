import * as THREE from "three";

export type WindUniforms = {
  uWindTime: { value: number };
  uWindStrength: { value: number };
};

export type SkyRig = {
  dome: THREE.Mesh;
  range: THREE.Group;
  sun: THREE.Mesh;
  uniforms: {
    uTop: { value: THREE.Color };
    uHorizon: { value: THREE.Color };
    uSunColor: { value: THREE.Color };
    uSunDirection: { value: THREE.Vector3 };
    uSunPower: { value: number };
  };
  rangeMaterials: THREE.MeshBasicMaterial[];
  sunMaterial: THREE.MeshBasicMaterial;
};

export const PALETTE = {
  skyDay: 0x4f95d8,
  skyNight: 0x0a1730,
  horizonDay: 0xd3ecef,
  horizonDusk: 0xf3c393,
  horizonNight: 0x1b2b4c,
  fieldLush: 0x77b055,
  fieldDry: 0xa9bd63,
  fieldShade: 0x4a7a44,
  cliff: 0x9c8c73,
  cliffShade: 0x6f6353,
  bark: 0x7c5a39,
  barkShade: 0x543a24,
  leafLight: 0x9ccd63,
  leafMid: 0x7ab455,
  leafDeep: 0x548c44,
  pine: 0x46855a,
  rock: 0x93938a,
  rockShade: 0x6f7168,
  moss: 0x6f9d4c,
} as const;

/**
 * Rampa de 4 degraus. Bandas largas e assimétricas dão a leitura de "pintura"
 * do BotW; uma rampa linear devolveria o sombreado contínuo do PBR.
 */
export function createToonGradient() {
  const steps = new Uint8Array([112, 166, 214, 255]);
  const texture = new THREE.DataTexture(steps, steps.length, 1, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Peso de vento por vértice. Constante por malha (copa balança inteira, tronco
 * quase não), modulado pela altura local para a base da folhagem ficar presa.
 */
export function setWindWeight(geometry: THREE.BufferGeometry, weight: number) {
  const position = geometry.getAttribute("position");
  const values = new Float32Array(position.count);
  if (weight > 0) {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const span = Math.max(0.001, box.max.y - box.min.y);
    for (let index = 0; index < position.count; index += 1) {
      const normalized = (position.getY(index) - box.min.y) / span;
      values[index] = weight * (0.35 + normalized * 0.65);
    }
  }
  geometry.setAttribute("aWind", new THREE.BufferAttribute(values, 1));
  return geometry;
}

export function applyWind<T extends THREE.Material>(material: T, strength: number, cacheKey: string) {
  const uniforms: WindUniforms = { uWindTime: { value: 0 }, uWindStrength: { value: strength } };
  material.userData.wind = uniforms;
  material.onBeforeCompile = shader => {
    shader.uniforms.uWindTime = uniforms.uWindTime;
    shader.uniforms.uWindStrength = uniforms.uWindStrength;
    shader.vertexShader = shader.vertexShader.replace("#include <common>", `#include <common>
attribute float aWind;
uniform float uWindTime;
uniform float uWindStrength;`);
    shader.vertexShader = shader.vertexShader.replace("#include <project_vertex>", `vec4 mvPosition=vec4(transformed,1.0);
#ifdef USE_INSTANCING
  mvPosition=instanceMatrix*mvPosition;
#endif
vec3 windAnchor=(modelMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
float windPhase=uWindTime*1.15+windAnchor.x*0.13+windAnchor.z*0.11;
float windGust=0.72+0.28*sin(uWindTime*0.37+windAnchor.x*0.05);
mvPosition.x+=sin(windPhase)*uWindStrength*aWind*windGust;
mvPosition.z+=cos(windPhase*0.81)*uWindStrength*aWind*windGust*0.72;
mvPosition.y-=abs(sin(windPhase))*uWindStrength*aWind*0.18;
mvPosition=modelViewMatrix*mvPosition;
gl_Position=projectionMatrix*mvPosition;`);
  };
  material.customProgramCacheKey = () => cacheKey;
  return material;
}

export function updateWind(materials: THREE.Material[], time: number) {
  for (const material of materials) {
    const wind = material.userData.wind as WindUniforms | undefined;
    if (wind) wind.uWindTime.value = time;
  }
}

const SKY_VERTEX = `
varying vec3 vDirection;
void main(){
  vDirection=normalize(position);
  gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
}`;

const SKY_FRAGMENT = `
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDirection;
uniform float uSunPower;
varying vec3 vDirection;
void main(){
  vec3 direction=normalize(vDirection);
  float height=clamp(direction.y*0.5+0.5,0.0,1.0);
  vec3 sky=mix(uHorizon,uTop,pow(smoothstep(0.42,1.0,height),0.72));
  float sunAngle=max(dot(direction,normalize(uSunDirection)),0.0);
  sky+=uSunColor*pow(sunAngle,42.0)*uSunPower;
  sky+=uSunColor*pow(sunAngle,6.0)*uSunPower*0.16;
  gl_FragColor=vec4(sky,1.0);
}`;

/**
 * Cúpula + cadeia de montanhas distante. As montanhas não recebem luz nem
 * névoa: são silhueta de perspectiva aérea, só dão escala ao horizonte.
 */
export function createSky(): SkyRig {
  const uniforms = {
    uTop: { value: new THREE.Color(PALETTE.skyDay) },
    uHorizon: { value: new THREE.Color(PALETTE.horizonDay) },
    uSunColor: { value: new THREE.Color(0xffe6b0) },
    uSunDirection: { value: new THREE.Vector3(-0.45, 0.42, -0.78).normalize() },
    uSunPower: { value: 1 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(1, 32, 20),
    new THREE.ShaderMaterial({ uniforms, vertexShader: SKY_VERTEX, fragmentShader: SKY_FRAGMENT, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.scale.setScalar(340);
  dome.frustumCulled = false;
  dome.renderOrder = -2;

  // Duas cristas: a de trás é mais alta e mais lavada, a da frente mais baixa e
  // um pouco mais densa. As camadas é que vendem a distância.
  const rangeMaterials = [
    new THREE.MeshBasicMaterial({ color: 0xb6cfe0, fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
    new THREE.MeshBasicMaterial({ color: 0x8fb0c8, fog: false, side: THREE.DoubleSide, transparent: true, opacity: 0.95 }),
  ];
  const range = new THREE.Group();
  range.add(new THREE.Mesh(createDistantRangeGeometry(292, 46, 1.9, 52), rangeMaterials[0]));
  range.add(new THREE.Mesh(createDistantRangeGeometry(214, 34, 1.05, 7), rangeMaterials[1]));
  range.children.forEach((child, index) => { child.frustumCulled = false; child.renderOrder = -2 + index * 0.1; });

  const sunMaterial = new THREE.MeshBasicMaterial({ color: 0xfff0c4, fog: false, transparent: true, opacity: 0.9 });
  const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 24), sunMaterial);
  sun.frustumCulled = false;
  sun.renderOrder = -1;

  return { dome, range, sun, uniforms, rangeMaterials, sunMaterial };
}

function createDistantRangeGeometry(radius: number, base: number, relief: number, phase: number) {
  const peaks = 54;
  const positions: number[] = [];
  const indices: number[] = [];
  for (let index = 0; index <= peaks; index += 1) {
    const angle = (index / peaks) * Math.PI * 2;
    const wave = Math.sin(angle * 3.1 + phase) * 0.5 + Math.sin(angle * 7.7 + phase * 1.3) * 0.32 + Math.sin(angle * 13.1 + phase) * 0.18;
    const height = base + wave * relief * 11;
    positions.push(Math.cos(angle) * radius, -8, Math.sin(angle) * radius);
    positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius);
  }
  for (let index = 0; index < peaks; index += 1) {
    const a = index * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  return geometry;
}

/** Cores do céu, névoa e montanhas para uma fração do ciclo dia/noite. */
export function skyPalette(daylight: number, duskWeight: number) {
  const top = new THREE.Color(PALETTE.skyNight).lerp(new THREE.Color(PALETTE.skyDay), Math.pow(daylight, 0.7));
  const horizon = new THREE.Color(PALETTE.horizonNight)
    .lerp(new THREE.Color(PALETTE.horizonDay), Math.pow(daylight, 0.55))
    .lerp(new THREE.Color(PALETTE.horizonDusk), duskWeight * 0.72);
  const haze = horizon.clone().lerp(top, 0.5);
  return { top, horizon, haze };
}
