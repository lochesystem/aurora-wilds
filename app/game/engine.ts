import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { animatePlayerModel, createPlayerAttackClips, createPlayerModel, PLAYER_MODEL_GROUND_OFFSET, setPlayerEquipment, type PlayerRig } from "./models";
import { lerpAngle, stepPlanarVelocity } from "./motion.js";
import type { GameSettings } from "./settings";
import { craftRecipe, getRecipe } from "./crafting.js";
import { BUILDING_PIECES, canBuild, footprintsOverlap, getBuildingPiece, snapToGrid } from "./building.js";
import { normalizeSave, SAVE_KEY, SAVE_VERSION } from "./save-game.js";
import { harvestHit, RESOURCE_HEALTH } from "./harvesting.js";
import { finishCombo, requestCombo } from "./combat-combo.js";
import { createFlowerField, createFlowerGeometry, createGrassField, createGrassGeometry, createGrassMaterial, updateGrassInteraction } from "./grass";
import { createSky, createToonGradient, PALETTE, skyPalette, updateWind, type SkyRig } from "./art";
import { createBerryBush, createFoliageAssets, createRock, createTree, disposeFoliageAssets, seededRandom, treeVariantFor, type FoliageAssets } from "./foliage";
import {
  CHUNK_LOAD_RADIUS,
  CHUNK_SEGMENTS,
  CHUNK_SIZE,
  WORLD_SEED,
  chunkKey,
  grassDensityAt,
  grassForChunk,
  grassTuftBudget,
  resourcesForChunk,
  terrainHeightAt,
  visibleChunkCoordinates,
  worldToChunk,
} from "./survival-world.js";

export interface GameSnapshot {
  health: number;
  hunger: number;
  berries: number;
  wood: number;
  stone: number;
  distance: number;
  chunks: number;
  biome: string;
  interaction: string;
  selectedSlot: number;
  axeDurability: number;
  pickaxeDurability: number;
  spearDurability: number;
  campfireKits: number;
  timeLabel: string;
  isNight: boolean;
  temperature: number;
  nearFire: boolean;
  survivedNights: number;
  hammer: boolean;
  buildingPiece: string;
  buildingValid: boolean;
  sheltered: boolean;
  comboStep: number;
  comboBuffered: number;
  gamepad: string;
}

interface Callbacks {
  onSnapshot: (snapshot: GameSnapshot) => void;
  onDeath: () => void;
  onToast: (message: string) => void;
  onDamage: () => void;
  onPause: () => void;
  onInventory: () => void;
  onBuildMenu: () => void;
}

type ResourceKind = "berry" | "wood" | "stone";
type ResourceDefinition = { id:string; kind:ResourceKind; x:number; y:number; z:number; scale:number };
type ResourceObject = ResourceDefinition & { object: THREE.Group; health:number; maxHealth:number; hitFlash:number; destroying:number };
type ResourceDrop = {mesh:THREE.Mesh;velocity:THREE.Vector3;life:number};
type LoadedChunk = { group: THREE.Group; collider: RAPIER.Collider; resources: ResourceObject[]; grass:THREE.InstancedMesh|null; flowers:THREE.InstancedMesh|null; chunkX:number; chunkZ:number };
type Campfire = { group:THREE.Group; flame:THREE.Mesh; light:THREE.PointLight; position:THREE.Vector3; phase:number };
type BuildingDefinition = (typeof BUILDING_PIECES)[number];
type StructureStorage = {berries:number;wood:number;stone:number};
type Structure = {id:string;group:THREE.Group;position:THREE.Vector3;rotation:number;definition:BuildingDefinition;collider:RAPIER.Collider|null;storage:StructureStorage};
type SavedStructure = {id:string;x:number;y:number;z:number;rotation:number;storage?:StructureStorage};

const EMPTY_SNAPSHOT: GameSnapshot = {
  health: 100, hunger: 78, berries: 0, wood: 0, stone: 0,
  distance: 0, chunks: 0, biome: "Campos de Aurora", interaction: "", selectedSlot:0,
  axeDurability:0,pickaxeDurability:0,spearDurability:0,campfireKits:0,timeLabel:"07:00",isNight:false,temperature:18,nearFire:false,survivedNights:0,
  hammer:false,buildingPiece:"",buildingValid:false,sheltered:false,comboStep:0,comboBuffered:0,gamepad: "",
};

export class AuroraGame {
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private bloom!: UnrealBloomPass;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(58, 1, 0.1, 360);
  private clock = new THREE.Clock();
  private frame = 0;
  private world!: RAPIER.World;
  private character!: RAPIER.KinematicCharacterController;
  private playerBody!: RAPIER.RigidBody;
  private playerCollider!: RAPIER.Collider;
  private player = new THREE.Group();
  private playerVisual = new THREE.Group();
  private playerRig!: PlayerRig;
  private playerMixer!: THREE.AnimationMixer;
  private attackClips!: ReturnType<typeof createPlayerAttackClips>;
  private attackAction: THREE.AnimationAction | null = null;
  private settings!: GameSettings;
  private loadedChunks = new Map<string, LoadedChunk>();
  private collectedResources = new Set<string>();
  private keys = new Set<string>();
  private pressed = new Set<string>();
  private listeners: Array<() => void> = [];
  private mouseDown = false;
  private paused = true;
  private initialized = false;
  private destroyed = false;
  private grounded = false;
  private verticalVelocity = 0;
  private horizontalVelocity = new THREE.Vector3();
  private yaw = 0.65;
  private pitch = 0.48;
  private health = 100;
  private hunger = 78;
  private berries = 0;
  private wood = 0;
  private stone = 0;
  private axeDurability = 0;
  private pickaxeDurability = 0;
  private spearDurability = 0;
  private campfireKits = 0;
  private hammer = false;
  private campfires: Campfire[] = [];
  private structures: Structure[] = [];
  private buildingDefinition: BuildingDefinition | null = null;
  private buildingGhost: THREE.Group | null = null;
  private buildingRotation = 0;
  private buildingValid = false;
  private nearestChest: Structure | null = null;
  private respawnPosition: THREE.Vector3 | null = null;
  private spawnPosition = new THREE.Vector3(0,terrainHeightAt(0,0)+2.2,0);
  private pendingCampfires: Array<{x:number;y:number;z:number}> = [];
  private pendingStructures: SavedStructure[] = [];
  private saveTimer = 4;
  private survivalTime = 0;
  private wasNight = false;
  private survivedNights = 0;
  private snapshotTimer = 0;
  private hurtCooldown = 0;
  private nearestResource: ResourceObject | null = null;
  private resourceDamage = new Map<string,number>();
  private resourceDrops: ResourceDrop[] = [];
  private attackTime = 0;
  private attackTarget: ResourceObject | null = null;
  private attackImpactDone = false;
  private comboStep = 0;
  private comboBuffered = 0;
  private comboResetTimer = 0;
  private equippedVisual = "";
  private selectedSlot = 0;
  private gamepadIndex: number | null = null;
  private gamepadButtons = new Set<number>();
  private lastGamepadName = "";
  private toonGradient = createToonGradient();
  private foliage: FoliageAssets = createFoliageAssets(this.toonGradient);
  private terrainMaterial = new THREE.MeshToonMaterial({ color:0xffffff, gradientMap:this.toonGradient, vertexColors:true });
  private grassGeometry=createGrassGeometry();
  private flowerGeometry=createFlowerGeometry();
  private grassMaterial=createGrassMaterial();
  private grassTrail=new THREE.Vector3(0,-100,0);
  private sky: SkyRig = createSky();
  private sunDirection = new THREE.Vector3(-0.45, 0.62, -0.65).normalize();
  private sun = new THREE.DirectionalLight(0xffefc5, 2.4);
  private hemi = new THREE.HemisphereLight(0xcfe6ff, 0x51663f, 1.65);

  constructor(private canvas: HTMLCanvasElement, private callbacks: Callbacks) {}

  async init(settings: GameSettings) {
    this.settings = settings;
    const restored=this.restoreState();
    await RAPIER.init();
    if (this.destroyed) return;
    this.world = new RAPIER.World({ x:0, y:-24, z:0 });
    this.character = this.world.createCharacterController(0.05);
    this.character.enableAutostep(0.38, 0.2, true);
    this.character.enableSnapToGround(0.32);
    this.character.setMaxSlopeClimbAngle(52 * Math.PI / 180);
    this.setupRenderer();
    this.setupWorld();
    this.restoreWorldObjects();
    this.setupInput();
    this.applySettings(settings);
    if(!restored)this.reset();else this.emitSnapshot();
    this.initialized = true;
    this.clock.start();
    this.loop();
  }

  private setupRenderer() {
    this.renderer = new THREE.WebGLRenderer({ canvas:this.canvas, antialias:true, powerPreference:"high-performance" });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.45, 1.04);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.resize();
  }

  private setupWorld() {
    this.scene.background = new THREE.Color(PALETTE.horizonDay);
    // Névoa larga: a perspectiva aérea é o que dá profundidade ao horizonte no
    // visual do BotW, então ela começa cedo e nunca fecha totalmente.
    this.scene.fog = new THREE.Fog(PALETTE.horizonDay, 26, 122);
    this.scene.add(this.hemi);
    this.scene.add(this.sky.dome, this.sky.range, this.sky.sun);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.camera.left = -46; this.sun.shadow.camera.right = 46;
    this.sun.shadow.camera.top = 46; this.sun.shadow.camera.bottom = -46;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.02;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    this.playerRig = createPlayerModel(this.toonGradient);
    this.playerMixer=new THREE.AnimationMixer(this.playerRig.group);this.attackClips=createPlayerAttackClips();
    this.playerVisual = this.playerRig.group;
    this.player.add(this.playerVisual);
    this.scene.add(this.player);
    this.grassTrail.copy(this.spawnPosition);

    const {x:startX,y:startY,z:startZ}=this.spawnPosition;
    this.playerBody = this.world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(startX, startY, startZ));
    this.playerCollider = this.world.createCollider(RAPIER.ColliderDesc.capsule(0.55, 0.38), this.playerBody);
    this.syncChunks(true);
    this.camera.position.set(startX+9, startY + 7, startZ+12);
  }

  private buildChunk(chunkX: number, chunkZ: number): LoadedChunk {
    const group = new THREE.Group();
    const originX = chunkX * CHUNK_SIZE;
    const originZ = chunkZ * CHUNK_SIZE;
    group.position.set(originX, 0, originZ);
    const vertices: number[] = [];
    const indices: number[] = [];
    for (let z = 0; z <= CHUNK_SEGMENTS; z += 1) {
      for (let x = 0; x <= CHUNK_SEGMENTS; x += 1) {
        const localX = x / CHUNK_SEGMENTS * CHUNK_SIZE;
        const localZ = z / CHUNK_SEGMENTS * CHUNK_SIZE;
        vertices.push(localX, terrainHeightAt(originX + localX, originZ + localZ), localZ);
      }
    }
    const row = CHUNK_SEGMENTS + 1;
    for (let z = 0; z < CHUNK_SEGMENTS; z += 1) for (let x = 0; x < CHUNK_SEGMENTS; x += 1) {
      const a = z * row + x, b = a + 1, c = a + row, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(this.terrainColors(geometry, originX, originZ), 3));
    const terrain = new THREE.Mesh(geometry, this.terrainMaterial);
    terrain.receiveShadow = true;
    terrain.castShadow = false;
    group.add(terrain);
    const grassBudget=grassTuftBudget(this.settings.grassAmount);
    const tufts=grassBudget>0?grassForChunk(chunkX,chunkZ,grassBudget):[];
    const grass=tufts.length?createGrassField(tufts,this.grassGeometry,this.grassMaterial):null;
    if(grass)group.add(grass);
    const flowers=tufts.length?createFlowerField(tufts,this.flowerGeometry,this.grassMaterial):null;
    if(flowers)group.add(flowers);

    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices)).setTranslation(originX, 0, originZ),
    );
    const definitions = resourcesForChunk(chunkX, chunkZ) as ResourceDefinition[];
    const resources = definitions
      .filter(resource => !this.collectedResources.has(resource.id))
      .map(resource => {const maxHealth=resource.kind==="berry"?1:RESOURCE_HEALTH[resource.kind];return{...resource,object:this.createResourceObject(resource),maxHealth,health:Math.max(1,maxHealth-(this.resourceDamage.get(resource.id)??0)),hitFlash:0,destroying:0};});
    for (const resource of resources) group.add(resource.object);
    this.scene.add(group);
    return { group, collider, resources, grass, flowers, chunkX, chunkZ };
  }

  /**
   * Cor por vértice do terreno: umidade decide entre campo viçoso e capim seco,
   * inclinação revela a rocha da encosta e os vales ficam mais fechados.
   */
  private terrainColors(geometry: THREE.BufferGeometry, originX: number, originZ: number) {
    const position = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    const colors = new Float32Array(position.count * 3);
    const lush = new THREE.Color(PALETTE.fieldLush);
    const dry = new THREE.Color(PALETTE.fieldDry);
    const shade = new THREE.Color(PALETTE.fieldShade);
    const cliff = new THREE.Color(PALETTE.cliff);
    const cliffShade = new THREE.Color(PALETTE.cliffShade);
    const color = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const worldX = originX + position.getX(index);
      const worldZ = originZ + position.getZ(index);
      const height = position.getY(index);
      const slope = THREE.MathUtils.smoothstep(1 - normal.getY(index), 0.16, 0.46);
      color.copy(dry).lerp(lush, grassDensityAt(worldX, worldZ));
      color.lerp(shade, THREE.MathUtils.clamp((1.5 - height) / 7, 0, 0.45));
      color.lerp(dry, THREE.MathUtils.clamp((height - 3.2) / 4, 0, 0.4));
      color.lerp(cliff.clone().lerp(cliffShade, slope * 0.5), slope);
      colors.set([color.r, color.g, color.b], index * 3);
    }
    return colors;
  }

  private createResourceObject(resource: ResourceDefinition) {
    const random = seededRandom(resource.id);
    const object = resource.kind === "wood"
      ? createTree(this.foliage, treeVariantFor(random()), random)
      : resource.kind === "berry"
        ? createBerryBush(this.foliage, random)
        : createRock(this.foliage, random);
    object.position.set(resource.x - worldToChunk(resource.x) * CHUNK_SIZE, resource.y, resource.z - worldToChunk(resource.z) * CHUNK_SIZE);
    object.scale.setScalar(resource.scale);
    return object;
  }

  private syncChunks(force = false) {
    const position = this.playerBody?.translation() ?? { x:0, z:0 };
    const centerX = worldToChunk(position.x);
    const centerZ = worldToChunk(position.z);
    const desired = new Set(visibleChunkCoordinates(centerX, centerZ, CHUNK_LOAD_RADIUS).map(({x,z}:{x:number;z:number}) => chunkKey(x,z)));
    if (!force && desired.size === this.loadedChunks.size && [...desired].every(key => this.loadedChunks.has(key))) return;
    for (const [key, chunk] of this.loadedChunks) if (!desired.has(key)) {
      this.scene.remove(chunk.group);
      (chunk.group.children[0] as THREE.Mesh).geometry.dispose();
      chunk.grass?.dispose(); chunk.flowers?.dispose();
      this.world.removeCollider(chunk.collider, false);
      this.loadedChunks.delete(key);
    }
    for (const {x,z} of visibleChunkCoordinates(centerX, centerZ, CHUNK_LOAD_RADIUS)) {
      const key = chunkKey(x,z);
      if (!this.loadedChunks.has(key)) this.loadedChunks.set(key, this.buildChunk(x,z));
    }
  }

  private rebuildGrass(){
    const budget=grassTuftBudget(this.settings.grassAmount);
    for(const chunk of this.loadedChunks.values()){
      if(chunk.grass){chunk.group.remove(chunk.grass);chunk.grass.dispose();chunk.grass=null;}
      if(chunk.flowers){chunk.group.remove(chunk.flowers);chunk.flowers.dispose();chunk.flowers=null;}
      if(budget<=0)continue;
      const tufts=grassForChunk(chunk.chunkX,chunk.chunkZ,budget);
      chunk.grass=createGrassField(tufts,this.grassGeometry,this.grassMaterial);chunk.group.add(chunk.grass);
      chunk.flowers=createFlowerField(tufts,this.flowerGeometry,this.grassMaterial);
      if(chunk.flowers)chunk.group.add(chunk.flowers);
    }
  }

  private setupInput() {
    const onKeyDown = (event:KeyboardEvent) => { const key=event.key.toLowerCase(); if(!this.keys.has(key))this.pressed.add(key); this.keys.add(key); if([" ","arrowup","arrowdown","arrowleft","arrowright"].includes(key))event.preventDefault(); };
    const onKeyUp = (event:KeyboardEvent) => this.keys.delete(event.key.toLowerCase());
    const onPointerDown = (event:PointerEvent) => { this.mouseDown=true; this.canvas.setPointerCapture?.(event.pointerId); };
    const onPointerUp = () => { this.mouseDown=false; };
    const onPointerMove = (event:PointerEvent) => { if(!this.mouseDown||this.paused)return; this.yaw-=event.movementX*.003*this.settings.cameraSensitivity; this.pitch+=(this.settings.invertY?-1:1)*event.movementY*.0025*this.settings.cameraSensitivity; this.pitch=THREE.MathUtils.clamp(this.pitch,.12,1.05); };
    const onWheel = (event:WheelEvent) => { if(this.paused)return; event.preventDefault(); this.selectHotbarSlot(this.selectedSlot+(event.deltaY>0?1:-1)); };
    const onResize = () => this.resize();
    const bind = <K extends keyof WindowEventMap>(type:K,fn:(event:WindowEventMap[K])=>void) => { window.addEventListener(type,fn as EventListener); this.listeners.push(()=>window.removeEventListener(type,fn as EventListener)); };
    bind("keydown",onKeyDown); bind("keyup",onKeyUp); bind("pointerup",onPointerUp); bind("resize",onResize);
    this.canvas.addEventListener("pointerdown",onPointerDown); this.canvas.addEventListener("pointermove",onPointerMove);
    this.canvas.addEventListener("wheel",onWheel,{passive:false});
    this.listeners.push(()=>this.canvas.removeEventListener("pointerdown",onPointerDown),()=>this.canvas.removeEventListener("pointermove",onPointerMove),()=>this.canvas.removeEventListener("wheel",onWheel));
  }

  private loop = () => {
    if(this.destroyed)return;
    this.frame=requestAnimationFrame(this.loop);
    const dt=Math.min(this.clock.getDelta(),.033);
    this.updateGamepad();
    if(!this.paused&&this.initialized)this.update(dt); else this.updateAmbient();
    this.updateGrass(dt);
    updateWind(this.foliage.materials.wind,performance.now()*.001);
    this.composer.render();
    this.pressed.clear();
  };

  private update(dt: number) {
    if(this.buildingDefinition&&(this.pressed.has("escape")||this.consumePad(1))){this.cancelBuilding();return;}
    if(this.pressed.has("i")||this.consumePad(17)){this.callbacks.onInventory();return;}
    if(this.pressed.has("escape")||this.consumePad(9)){this.callbacks.onPause();return;}
    if(!this.buildingDefinition){for(let slot=0;slot<9;slot+=1)if(this.pressed.has(String(slot+1)))this.selectHotbarSlot(slot);if(this.consumePad(4)||this.consumePad(14))this.selectHotbarSlot(this.selectedSlot-1,true);if(this.consumePad(5)||this.consumePad(15))this.selectHotbarSlot(this.selectedSlot+1,true);}
    else if(this.pressed.has("r")||this.consumePad(6)||this.consumePad(7))this.rotateBuilding();
    this.survivalTime += dt;
    this.hurtCooldown = Math.max(0, this.hurtCooldown-dt);
    this.updateAttackState(dt);
    const pad=this.getPad(); const left=this.deadzone(pad?.axes[0]??0,pad?.axes[1]??0);
    let mx=left.x,my=left.y;
    if(this.keys.has("a")||this.keys.has("arrowleft"))mx-=1; if(this.keys.has("d")||this.keys.has("arrowright"))mx+=1;
    if(this.keys.has("w")||this.keys.has("arrowup"))my-=1; if(this.keys.has("s")||this.keys.has("arrowdown"))my+=1;
    const inputLength=Math.hypot(mx,my); if(inputLength>1){mx/=inputLength;my/=inputLength;}
    if(pad){const right=this.deadzone(pad.axes[2]??0,pad.axes[3]??0);this.yaw-=right.x*2.2*dt*this.settings.cameraSensitivity;this.pitch+=(this.settings.invertY?-1:1)*right.y*1.8*dt*this.settings.cameraSensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch,.12,1.05);}
    const jump=this.pressed.has(" ")||this.consumePad(0);
    if(jump&&this.grounded){this.verticalVelocity=9.4;this.grounded=false;this.pulse(.3,75);}
    this.verticalVelocity += -24 * dt;
    const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    const move=forward.multiplyScalar(-my).add(right.multiplyScalar(mx));
    if(move.lengthSq()>.001){move.normalize();if(!this.attackTarget)this.playerVisual.rotation.y=lerpAngle(this.playerVisual.rotation.y,Math.atan2(move.x,move.z),.2);}
    if(this.attackTarget)this.playerVisual.rotation.y=lerpAngle(this.playerVisual.rotation.y,Math.atan2(this.attackTarget.x-this.player.position.x,this.attackTarget.z-this.player.position.z),.35);
    const sprinting=(this.keys.has("shift")||this.gamepadButtons.has(10))&&move.lengthSq()>.01&&this.hunger>2;
    const speedScale=sprinting?1.35:.92;
    const velocity=stepPlanarVelocity({x:this.horizontalVelocity.x,z:this.horizontalVelocity.z},{x:move.x,z:move.z},dt,this.grounded,false,speedScale);
    this.horizontalVelocity.set(velocity.x,0,velocity.z);
    const desired={x:this.horizontalVelocity.x*dt,y:this.verticalVelocity*dt,z:this.horizontalVelocity.z*dt};
    this.character.computeColliderMovement(this.playerCollider,desired,undefined,undefined,collider=>collider!==this.playerCollider);
    const actual=this.character.computedMovement(); const translation=this.playerBody.translation();
    this.playerBody.setNextKinematicTranslation({x:translation.x+actual.x,y:translation.y+actual.y,z:translation.z+actual.z});
    this.grounded=this.character.computedGrounded(); if(this.grounded&&this.verticalVelocity<0)this.verticalVelocity=-.45;
    this.world.step();
    const position=this.playerBody.translation(); this.player.position.set(position.x,position.y-.93+PLAYER_MODEL_GROUND_OFFSET,position.z);
    const animationTime=performance.now()*.009;
    this.updateEquippedVisual();
    const attackProgress=this.attackTime>0?1-this.attackTime/.62:0;
    animatePlayerModel(this.playerRig,animationTime,this.horizontalVelocity.length(),this.grounded,this.verticalVelocity,sprinting);
    this.playerMixer.update(dt);
    if(this.attackTarget&&!this.attackImpactDone&&attackProgress>=.54){this.attackImpactDone=true;this.resolveResourceHit(this.attackTarget);}
    this.syncChunks();
    this.updateNearestResource();
    this.updateNearestChest();
    this.updateCampfires(dt);
    this.updateResourceAnimations(dt);this.updateResourceDrops(dt);
    const primaryAction=this.pressed.has("q")||this.consumePad(3);
    if(this.buildingDefinition){this.updateBuildingPreview();if(primaryAction)this.placeBuilding();}
    else{
      if(this.pressed.has("e")||this.consumePad(2)){if(this.nearestChest)this.interactChest(this.nearestChest);else if(this.nearestResource?.kind==="berry")this.collect(this.nearestResource);else if(this.nearestResource)this.callbacks.onToast("Golpeie o recurso para extrair material");}
      if(primaryAction){if(this.nearestResource&&this.nearestResource.kind!=="berry")this.attackResource(this.nearestResource);else this.useSelectedItem();}
    }
    this.hunger=Math.max(0,this.hunger-dt*(sprinting?.62:.34));
    const worldState=this.getWorldState();
    if(worldState.isNight&&!this.wasNight)this.callbacks.onToast("A noite chegou — encontre calor");
    if(!worldState.isNight&&this.wasNight){this.survivedNights+=1;this.callbacks.onToast(this.survivedNights===1?"Primeiro amanhecer alcançado!":"Você sobreviveu a mais uma noite");}
    this.wasNight=worldState.isNight;
    if(this.hunger<=0){this.health=Math.max(0,this.health-dt*5);if(this.hurtCooldown<=0){this.hurtCooldown=1;this.callbacks.onDamage();}}
    if(worldState.temperature<5){this.health=Math.max(0,this.health-dt*2.6);if(this.hurtCooldown<=0){this.hurtCooldown=1;this.callbacks.onDamage();}}
    else if(this.hunger>70&&this.health<100)this.health=Math.min(100,this.health+dt*.6);
    if(position.y<terrainHeightAt(position.x,position.z)-12||this.health<=0){this.handleDefeat();return;}
    this.updateCamera(dt); this.updateAmbient();
    this.snapshotTimer-=dt; if(this.snapshotTimer<=0){this.snapshotTimer=.14;this.emitSnapshot();}
    this.saveTimer-=dt;if(this.saveTimer<=0){this.saveTimer=4;this.saveGame();}
  }

  private updateNearestResource() {
    let nearest:ResourceObject|null=null; let nearestDistance=2.35;
    for(const chunk of this.loadedChunks.values())for(const resource of chunk.resources){if(!resource.object.visible||resource.destroying>0)continue;const distance=Math.hypot(this.player.position.x-resource.x,this.player.position.z-resource.z);if(distance<nearestDistance){nearest=resource;nearestDistance=distance;}}
    this.nearestResource=nearest;
  }

  private updateNearestChest(){
    let nearest:Structure|null=null,distance=2.5;for(const structure of this.structures){if(structure.id!=="chest")continue;const next=Math.hypot(this.player.position.x-structure.position.x,this.player.position.z-structure.position.z);if(next<distance){nearest=structure;distance=next;}}this.nearestChest=nearest;
  }

  private interactChest(chest:Structure){
    const storage=chest.storage;const carried=this.berries+this.wood+this.stone;
    if(carried>0){storage.berries+=this.berries;storage.wood+=this.wood;storage.stone+=this.stone;this.berries=0;this.wood=0;this.stone=0;this.callbacks.onToast("Recursos guardados no baú");}
    else if(storage.berries+storage.wood+storage.stone>0){this.berries+=storage.berries;this.wood+=storage.wood;this.stone+=storage.stone;storage.berries=0;storage.wood=0;storage.stone=0;this.callbacks.onToast("Recursos retirados do baú");}
    else this.callbacks.onToast("O baú está vazio");this.saveGame();this.emitSnapshot();
  }

  private collect(resource: ResourceObject) {
    resource.object.visible=false; this.collectedResources.add(resource.id); this.nearestResource=null;
    if(resource.kind==="berry"){this.berries+=2;this.callbacks.onToast("Frutos solares +2");}
    this.pulse(.24,60); this.emitSnapshot();
  }

  private currentEquipment(){
    if(this.selectedSlot===2&&this.axeDurability>0)return"axe" as const;
    if(this.selectedSlot===3&&this.pickaxeDurability>0)return"pickaxe" as const;
    if(this.selectedSlot===7&&this.hammer)return"hammer" as const;
    if(this.selectedSlot===8&&this.spearDurability>0)return"spear" as const;
    return"hands" as const;
  }

  private updateEquippedVisual(){const equipped=this.currentEquipment();if(equipped===this.equippedVisual)return;this.equippedVisual=equipped;setPlayerEquipment(this.playerRig,equipped);}

  private updateAttackState(dt:number){
    const wasAttacking=this.attackTime>0;this.attackTime=Math.max(0,this.attackTime-dt);
    if(wasAttacking&&this.attackTime<=0){
      const next=finishCombo({step:this.comboStep,buffered:this.comboBuffered});this.comboStep=next.step;this.comboBuffered=next.buffered;
      if(next.startStep)this.beginComboStep(next.startStep,this.attackTarget);else this.comboResetTimer=.34;
    }else if(this.attackTime<=0&&this.comboResetTimer>0){this.comboResetTimer=Math.max(0,this.comboResetTimer-dt);if(this.comboResetTimer<=0){this.comboStep=0;this.comboBuffered=0;this.attackTarget=null;}}
  }

  private beginComboStep(step:number,target:ResourceObject|null){
    this.comboStep=step;this.attackTime=.62;this.comboResetTimer=0;this.attackTarget=target;this.attackImpactDone=false;
    this.attackAction?.stop();const equipped=this.currentEquipment(),set=equipped==="spear"||equipped==="hands"?this.attackClips.thrust:this.attackClips.chop,clip=set[Math.max(0,Math.min(2,step-1))];
    this.attackAction=this.playerMixer.clipAction(clip);this.attackAction.reset().setLoop(THREE.LoopOnce,1);this.attackAction.clampWhenFinished=false;this.attackAction.fadeIn(.035).play();
  }

  private startAttack(target:ResourceObject|null=null){
    const next=requestCombo({step:this.comboStep,buffered:this.comboBuffered,active:this.attackTime>0,windowOpen:this.comboResetTimer>0});this.comboStep=next.step;this.comboBuffered=next.buffered;
    if(target)this.attackTarget=target;if(next.startStep)this.beginComboStep(next.startStep,target??this.attackTarget);return true;
  }

  private attackResource(resource:ResourceObject){
    if(!this.startAttack(resource))return;
    this.playerVisual.rotation.y=Math.atan2(resource.x-this.player.position.x,resource.z-this.player.position.z);
  }

  private resolveResourceHit(resource:ResourceObject){
    if(resource.destroying>0||!resource.object.visible||Math.hypot(this.player.position.x-resource.x,this.player.position.z-resource.z)>2.8)return;
    const equipped=this.currentEquipment();const result=harvestHit(resource.kind,resource.health,equipped);
    resource.health=result.remaining;resource.hitFlash=.24;this.resourceDamage.set(resource.id,resource.maxHealth-resource.health);
    if(resource.kind==="wood")this.wood+=result.drop;else this.stone+=result.drop;
    if(result.durabilityCost&&equipped==="axe")this.axeDurability=Math.max(0,this.axeDurability-result.durabilityCost);
    if(result.durabilityCost&&equipped==="pickaxe")this.pickaxeDurability=Math.max(0,this.pickaxeDurability-result.durabilityCost);
    this.spawnResourceDrops(resource,result.drop);
    if(result.destroyed){this.collectedResources.add(resource.id);this.resourceDamage.delete(resource.id);resource.destroying=.62;this.nearestResource=null;}
    const label=resource.kind==="wood"?"Madeira":"Pedra",tool=result.strongTool?equipped==="axe"?" · machado":" · picareta":"";
    this.callbacks.onToast(`${label} +${result.drop}${tool}${result.destroyed?" · recurso esgotado":` · ${resource.health}/${resource.maxHealth}`}`);
    const comboBoost=1+(this.comboStep-1)*.16;this.pulse((result.strongTool?.5:.28)*comboBoost,result.strongTool?105:65);this.saveGame();this.emitSnapshot();
  }

  private spawnResourceDrops(resource:ResourceObject,amount:number){
    const material=new THREE.MeshToonMaterial({color:resource.kind==="wood"?0xb27a48:0x919b96,gradientMap:this.toonGradient});
    for(let index=0;index<Math.min(4,amount);index+=1){const geometry=resource.kind==="wood"?new THREE.BoxGeometry(.16,.16,.42):new THREE.DodecahedronGeometry(.16,0);const mesh=new THREE.Mesh(geometry,material.clone());mesh.position.set(resource.x,resource.y+.8,resource.z);mesh.rotation.set(Math.random(),Math.random(),Math.random());this.scene.add(mesh);this.resourceDrops.push({mesh,velocity:new THREE.Vector3((Math.random()-.5)*2.6,2.4+Math.random(),(Math.random()-.5)*2.6),life:.72});}
  }

  private updateResourceDrops(dt:number){
    for(let index=this.resourceDrops.length-1;index>=0;index-=1){const drop=this.resourceDrops[index];drop.life-=dt;drop.velocity.y-=7*dt;drop.mesh.position.addScaledVector(drop.velocity,dt);drop.mesh.rotation.x+=dt*5;drop.mesh.rotation.z+=dt*4;if(drop.life<.28)drop.mesh.position.lerp(this.player.position.clone().add(new THREE.Vector3(0,1,0)),.2);drop.mesh.scale.setScalar(Math.min(1,drop.life*4));if(drop.life<=0){this.scene.remove(drop.mesh);drop.mesh.geometry.dispose();(drop.mesh.material as THREE.Material).dispose();this.resourceDrops.splice(index,1);}}
  }

  private updateResourceAnimations(dt:number){
    for(const chunk of this.loadedChunks.values())for(const resource of chunk.resources){
      if(resource.hitFlash>0){resource.hitFlash=Math.max(0,resource.hitFlash-dt);resource.object.rotation.z=Math.sin(resource.hitFlash*70)*.055;resource.object.scale.setScalar(resource.scale*(1+resource.hitFlash*.32));}
      else if(resource.destroying<=0){resource.object.rotation.z=THREE.MathUtils.lerp(resource.object.rotation.z,0,.25);resource.object.scale.lerp(new THREE.Vector3(resource.scale,resource.scale,resource.scale),.2);}
      if(resource.destroying>0){resource.destroying-=dt;if(resource.kind==="wood")resource.object.rotation.z+=dt*2.3;resource.object.scale.multiplyScalar(Math.max(.8,1-dt*1.8));if(resource.destroying<=0)resource.object.visible=false;}
    }
  }

  private eatBerry() {
    if(this.berries<=0){this.callbacks.onToast("Procure arbustos com frutos dourados");return;}
    if(this.hunger>=99){this.callbacks.onToast("Você já está saciado");return;}
    this.berries-=1; this.hunger=Math.min(100,this.hunger+24); this.callbacks.onToast("Fome restaurada"); this.pulse(.16,45); this.emitSnapshot();
  }

  private useSelectedItem() {
    if(this.selectedSlot===1){this.eatBerry();return;}
    if(this.selectedSlot===0){this.startAttack();return;}
    if(this.selectedSlot===2){if(this.axeDurability>0)this.startAttack();else this.callbacks.onToast("Fabrique um machado no inventário");return;}
    if(this.selectedSlot===3){if(this.pickaxeDurability>0)this.startAttack();else this.callbacks.onToast("Fabrique uma picareta no inventário");return;}
    if(this.selectedSlot===4){this.placeCampfire();return;}
    if(this.selectedSlot===5||this.selectedSlot===6){this.callbacks.onToast("Abra o inventário para fabricar");return;}
    if(this.selectedSlot===7){if(this.hammer)this.callbacks.onBuildMenu();else this.callbacks.onToast("Fabrique um martelo no inventário");return;}
    if(this.selectedSlot===8){if(this.spearDurability>0)this.startAttack();else this.callbacks.onToast("Fabrique uma lança no inventário");return;}
  }

  craft(recipeId:string){
    const recipe=getRecipe(recipeId);if(!recipe)return false;
    const result=craftRecipe(recipe,{wood:this.wood,stone:this.stone});
    if(!result){this.callbacks.onToast("Materiais insuficientes");return false;}
    this.wood=result.wood;this.stone=result.stone;
    if(recipeId==="axe")this.axeDurability=100;
    if(recipeId==="pickaxe")this.pickaxeDurability=100;
    if(recipeId==="hammer")this.hammer=true;
    if(recipeId==="spear")this.spearDurability=100;
    if(recipeId==="campfire")this.campfireKits+=1;
    this.callbacks.onToast(`${recipe.name} fabricado`);this.pulse(.35,90);this.saveGame();this.emitSnapshot();return true;
  }

  private placeCampfire(){
    if(this.campfireKits<=0){this.callbacks.onToast("Fabrique uma fogueira no inventário");return;}
    const player=this.playerBody.translation();const facing=this.playerVisual.rotation.y;
    const x=player.x+Math.sin(facing)*2.2,z=player.z+Math.cos(facing)*2.2,y=terrainHeightAt(x,z);
    this.addCampfire(x,y,z);this.campfireKits-=1;this.callbacks.onToast("Fogueira acesa — permaneça por perto");this.pulse(.5,120);this.saveGame();this.emitSnapshot();
  }

  private addCampfire(x:number,y:number,z:number){
    const group=new THREE.Group();group.position.set(x,y,z);
    const logMaterial=new THREE.MeshToonMaterial({color:0x6d412d,gradientMap:this.toonGradient});
    for(const rotation of [-.62,.62]){const log=new THREE.Mesh(new THREE.CylinderGeometry(.12,.15,1.25,7),logMaterial);log.position.y=.14;log.rotation.set(0,rotation,Math.PI/2);log.castShadow=true;group.add(log);}
    const flame=new THREE.Mesh(new THREE.ConeGeometry(.32,.9,7),new THREE.MeshStandardMaterial({color:0xffc55c,emissive:0xff6b24,emissiveIntensity:4,roughness:.25}));flame.position.y=.7;group.add(flame);
    const light=new THREE.PointLight(0xff8b45,3.5,12,2);light.position.y=1.1;group.add(light);this.scene.add(group);
    this.campfires.push({group,flame,light,position:new THREE.Vector3(x,y,z),phase:this.campfires.length*1.7});
  }

  private restoreState(){
    if(typeof window==="undefined")return false;
    try{
      const raw=window.localStorage.getItem(SAVE_KEY);if(!raw)return false;
      const save=normalizeSave(JSON.parse(raw));if(!save)return false;
      this.health=save.health;this.hunger=save.hunger;this.berries=save.berries;this.wood=save.wood;this.stone=save.stone;
      this.axeDurability=save.axeDurability;this.pickaxeDurability=save.pickaxeDurability;this.spearDurability=save.spearDurability;this.hammer=save.hammer;
      this.campfireKits=save.campfireKits;this.survivalTime=save.survivalTime;this.survivedNights=save.survivedNights;this.selectedSlot=save.selectedSlot;
      this.collectedResources=new Set(save.collectedResources);this.resourceDamage=new Map(Object.entries(save.resourceDamage));this.pendingCampfires=save.campfires;this.pendingStructures=save.structures;
      this.spawnPosition.set(save.position.x,save.position.y,save.position.z);
      this.respawnPosition=save.respawn?new THREE.Vector3(save.respawn.x,save.respawn.y,save.respawn.z):null;
      return true;
    }catch{return false;}
  }

  private restoreWorldObjects(){
    for(const fire of this.pendingCampfires)this.addCampfire(fire.x,fire.y,fire.z);
    for(const saved of this.pendingStructures){const definition=getBuildingPiece(saved.id);if(definition)this.addStructure(definition,new THREE.Vector3(saved.x,saved.y,saved.z),saved.rotation,saved.storage);}
    this.pendingCampfires=[];this.pendingStructures=[];
  }

  private saveGame(){
    if(typeof window==="undefined"||!this.playerBody||this.health<=0)return;
    const position=this.playerBody.translation();
    try{window.localStorage.setItem(SAVE_KEY,JSON.stringify({
      version:SAVE_VERSION,position:{x:position.x,y:position.y,z:position.z},health:this.health,hunger:this.hunger,
      berries:this.berries,wood:this.wood,stone:this.stone,axeDurability:this.axeDurability,pickaxeDurability:this.pickaxeDurability,spearDurability:this.spearDurability,
      hammer:this.hammer,campfireKits:this.campfireKits,survivalTime:this.survivalTime,survivedNights:this.survivedNights,selectedSlot:this.selectedSlot,
      collectedResources:[...this.collectedResources],resourceDamage:Object.fromEntries(this.resourceDamage),campfires:this.campfires.map(fire=>({x:fire.position.x,y:fire.position.y,z:fire.position.z})),
      structures:this.structures.map(structure=>({id:structure.id,x:structure.position.x,y:structure.position.y,z:structure.position.z,rotation:structure.rotation,storage:structure.storage})),
      respawn:this.respawnPosition?{x:this.respawnPosition.x,y:this.respawnPosition.y,z:this.respawnPosition.z}:null,
    }));}catch{/* localStorage may be unavailable */}
  }

  startBuilding(pieceId:string){
    if(!this.hammer){this.callbacks.onToast("Fabrique um martelo primeiro");return false;}
    const definition=getBuildingPiece(pieceId);if(!definition)return false;
    this.cancelBuilding(false);this.buildingDefinition=definition;this.buildingRotation=0;
    this.buildingGhost=this.createStructureModel(definition,true);this.scene.add(this.buildingGhost);this.updateBuildingPreview();
    this.callbacks.onToast(`${definition.name}: posicione e confirme`);this.emitSnapshot();return true;
  }

  private cancelBuilding(notify=true){
    if(this.buildingGhost){this.scene.remove(this.buildingGhost);this.disposeGroup(this.buildingGhost);}
    this.buildingGhost=null;this.buildingDefinition=null;this.buildingValid=false;if(notify)this.callbacks.onToast("Construção cancelada");this.emitSnapshot();
  }

  private rotateBuilding(){this.buildingRotation=(this.buildingRotation+Math.PI/2)%(Math.PI*2);this.updateBuildingPreview();this.pulse(.08,30);}

  private updateBuildingPreview(){
    if(!this.buildingDefinition||!this.buildingGhost||!this.playerBody)return;
    const player=this.playerBody.translation(),facing=this.playerVisual.rotation.y;
    const x=snapToGrid(player.x+Math.sin(facing)*3.1),z=snapToGrid(player.z+Math.cos(facing)*3.1),y=terrainHeightAt(x,z);
    this.buildingGhost.position.set(x,y,z);this.buildingGhost.rotation.y=this.buildingRotation;
    const quarter=Math.round(this.buildingRotation/(Math.PI/2))%2;const [baseWidth,,baseDepth]=this.buildingDefinition.size;
    const width=quarter?baseDepth:baseWidth,depth=quarter?baseWidth:baseDepth;
    const overlap=this.structures.some(structure=>{
      if(structure.id!==this.buildingDefinition?.id)return false;
      const otherQuarter=Math.round(structure.rotation/(Math.PI/2))%2;const [otherWidth,,otherDepth]=structure.definition.size;
      return footprintsOverlap({x,z,width,depth},{x:structure.position.x,z:structure.position.z,width:otherQuarter?otherDepth:otherWidth,depth:otherQuarter?otherWidth:otherDepth});
    });
    const slope=Math.max(Math.abs(y-terrainHeightAt(x+width*.45,z)),Math.abs(y-terrainHeightAt(x,z+depth*.45)));
    this.buildingValid=canBuild(this.buildingDefinition,{wood:this.wood,stone:this.stone})&&!overlap&&slope<1.1;
    this.tintGhost(this.buildingGhost,this.buildingValid?0x69e6a0:0xff6b62);
  }

  private placeBuilding(){
    if(!this.buildingDefinition||!this.buildingGhost)return;
    if(!this.buildingValid){this.callbacks.onToast("Local inválido ou materiais insuficientes");this.pulse(.22,70);return;}
    const definition=this.buildingDefinition,position=this.buildingGhost.position.clone(),rotation=this.buildingRotation;
    this.wood-=definition.cost.wood;this.stone-=definition.cost.stone;this.addStructure(definition,position,rotation);
    if(definition.id==="bed"){this.respawnPosition=new THREE.Vector3(position.x,position.y+1.6,position.z);this.callbacks.onToast("Cama pronta — ponto de retorno definido");}
    else this.callbacks.onToast(`${definition.name} construída`);
    this.pulse(.45,110);this.cancelBuilding(false);this.saveGame();this.emitSnapshot();
  }

  private addStructure(definition:BuildingDefinition,position:THREE.Vector3,rotation:number,storage?:StructureStorage){
    const group=this.createStructureModel(definition,false);group.position.copy(position);group.rotation.y=rotation;this.scene.add(group);
    let collider:RAPIER.Collider|null=null;
    if(definition.id!=="door"){
      const [width,height,depth]=definition.size;
      collider=this.world.createCollider(RAPIER.ColliderDesc.cuboid(width/2,height/2,depth/2).setTranslation(position.x,position.y+definition.yOffset,position.z).setRotation({x:0,y:Math.sin(rotation/2),z:0,w:Math.cos(rotation/2)}));
    }
    this.structures.push({id:definition.id,group,position:position.clone(),rotation,definition,collider,storage:storage??{berries:0,wood:0,stone:0}});
  }

  private createStructureModel(definition:BuildingDefinition,ghost:boolean){
    const group=new THREE.Group();const wood=new THREE.MeshToonMaterial({color:0x8a633d,gradientMap:this.toonGradient});const dark=new THREE.MeshToonMaterial({color:0x4e3829,gradientMap:this.toonGradient});const cloth=new THREE.MeshToonMaterial({color:0x759b83,gradientMap:this.toonGradient});
    const box=(size:[number,number,number],position:[number,number,number],material:THREE.Material=wood)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);};
    if(definition.id==="foundation")box([3,.28,3],[0,.14,0]);
    if(definition.id==="wall")for(const x of [-1.2,-.6,0,.6,1.2])box([.52,2.7,.22],[x,1.35,0]);
    if(definition.id==="door"){box([.48,2.7,.22],[-1.25,1.35,0]);box([.48,2.7,.22],[1.25,1.35,0]);box([2.05,.52,.22],[0,2.44,0]);}
    if(definition.id==="roof")box([3.3,.25,3.3],[0,2.78,0]);
    if(definition.id==="chest"){box([1.25,.62,.75],[0,.31,0],dark);box([1.3,.18,.8],[0,.72,0],wood);box([.12,.28,.08],[0,.46,.41],new THREE.MeshToonMaterial({color:0xd7aa52,gradientMap:this.toonGradient}));}
    if(definition.id==="bed"){box([1.2,.18,2.2],[0,.12,0],dark);box([1.05,.22,1.98],[0,.31,0],cloth);box([.95,.2,.48],[0,.48,-.68],new THREE.MeshToonMaterial({color:0xd9d1b7,gradientMap:this.toonGradient}));}
    if(ghost)group.traverse(object=>{if(object instanceof THREE.Mesh){object.material=(object.material as THREE.Material).clone();const material=object.material as THREE.MeshStandardMaterial;material.transparent=true;material.opacity=.48;object.castShadow=false;}});
    return group;
  }

  private tintGhost(group:THREE.Group,color:number){group.traverse(object=>{if(object instanceof THREE.Mesh){const material=object.material as THREE.MeshStandardMaterial;material.color.set(color);material.emissive.set(color);material.emissiveIntensity=.16;}});}
  private disposeGroup(group:THREE.Group){group.traverse(object=>{if(object instanceof THREE.Mesh){object.geometry.dispose();const materials=Array.isArray(object.material)?object.material:[object.material];materials.forEach(material=>material.dispose());}});}

  private handleDefeat(){
    if(this.respawnPosition){this.health=55;this.hunger=45;this.verticalVelocity=0;this.playerBody.setTranslation(this.respawnPosition,true);this.playerBody.setNextKinematicTranslation(this.respawnPosition);this.callbacks.onToast("Você despertou na cama do acampamento");this.pulse(.7,180);this.saveGame();return;}
    this.paused=true;try{window.localStorage.removeItem(SAVE_KEY);}catch{}this.callbacks.onDeath();
  }

  private updateCampfires(dt:number){
    const time=performance.now()*.006;
    for(const fire of this.campfires){const flicker=1+Math.sin(time*3+fire.phase)*.12+Math.sin(time*7)*.05;fire.flame.scale.set(flicker,1/flicker,flicker);fire.flame.rotation.y+=dt*1.8;fire.light.intensity=3.1+Math.sin(time*5+fire.phase)*.55;}
  }

  private updateGrass(dt:number){
    if(!this.playerBody)return;
    const body=this.playerBody.translation(),player=new THREE.Vector3(body.x,body.y,body.z);
    const follow=1-Math.exp(-dt*2.1);this.grassTrail.lerp(player,follow);
    updateGrassInteraction(this.grassMaterial,performance.now()*.001,player,this.grassTrail,this.horizontalVelocity);
  }

  private getWorldState(){
    const fraction=(this.survivalTime/180+.3)%1;const isNight=fraction<.22||fraction>.78;
    const position=this.playerBody?.translation()??{x:0,y:0,z:0};const nearFire=this.campfires.some(fire=>Math.hypot(position.x-fire.position.x,position.z-fire.position.z)<6);
    const sheltered=this.structures.some(structure=>structure.id==="roof"&&Math.abs(position.x-structure.position.x)<2.15&&Math.abs(position.z-structure.position.z)<2.15&&position.y<structure.position.y+3.2);
    const terrain=terrainHeightAt(position.x,position.z);const temperature=Math.round(nearFire?23:(isNight?(sheltered?9:3):18)-Math.max(0,terrain-2)*.45);
    const totalMinutes=Math.floor(fraction*24*60);const hours=String(Math.floor(totalMinutes/60)).padStart(2,"0"),minutes=String(totalMinutes%60).padStart(2,"0");
    return{fraction,isNight,nearFire,sheltered,temperature,timeLabel:`${hours}:${minutes}`};
  }

  private updateCamera(dt:number) {
    const target=this.player.position.clone().add(new THREE.Vector3(0,1.3,0)); const distance=10.2;
    const desired=target.clone().add(new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*distance,Math.sin(this.pitch)*distance+1,Math.cos(this.yaw)*Math.cos(this.pitch)*distance));
    const alpha=1-Math.pow(.001,dt); this.camera.position.lerp(desired,alpha); this.camera.lookAt(target);
  }

  private updateAmbient() {
    const {fraction}=this.getWorldState();
    const daylight=Math.max(0,Math.sin((fraction-.25)*Math.PI*2));
    const dusk=Math.max(0,1-Math.abs(daylight-.24)/.24);
    // O sol percorre o céu: a sombra girando ao longo do dia é metade da
    // sensação de mundo vivo, e a luz rasante do fim de tarde vem de graça.
    const arc=(fraction-.25)*Math.PI*2;
    this.sunDirection.set(Math.cos(arc)*.62,Math.max(.06,Math.sin(arc)),-.52).normalize();
    const anchor=this.player.position;
    this.sun.position.copy(anchor).addScaledVector(this.sunDirection,62);
    this.sun.target.position.copy(anchor);
    this.sun.color.setHex(0xffefc5).lerp(new THREE.Color(0xffb478),dusk*.7);
    this.sun.intensity=.16+daylight*2.5;
    this.hemi.intensity=.34+daylight*1.32;
    this.hemi.color.setHex(0x2a3f66).lerp(new THREE.Color(0xcfe6ff),daylight);

    const {top,horizon,haze}=skyPalette(daylight,dusk);
    this.sky.uniforms.uTop.value.copy(top);
    this.sky.uniforms.uHorizon.value.copy(horizon);
    this.sky.uniforms.uSunColor.value.setHex(0xffe6b0).lerp(new THREE.Color(0xff9d5e),dusk);
    this.sky.uniforms.uSunDirection.value.copy(this.sunDirection);
    this.sky.uniforms.uSunPower.value=.35+daylight*.85;
    this.sky.dome.position.copy(this.camera.position);
    this.sky.range.position.set(anchor.x,anchor.y-4,anchor.z);
    this.sky.rangeMaterials[0].color.copy(haze).lerp(top,.3);
    this.sky.rangeMaterials[1].color.copy(haze).lerp(top,.62).multiplyScalar(.9);
    this.sky.sun.position.copy(anchor).addScaledVector(this.sunDirection,240);
    this.sky.sun.lookAt(anchor);
    this.sky.sunMaterial.color.setHex(0xfff0c4).lerp(new THREE.Color(0xffb06a),dusk);
    this.sky.sunMaterial.opacity=.25+daylight*.7;
    (this.scene.background as THREE.Color).copy(haze);(this.scene.fog as THREE.Fog).color.copy(haze);

    const terrainTone=.72+daylight*.34;this.terrainMaterial.color.setRGB(terrainTone,terrainTone,terrainTone*(1.04-daylight*.04));
    // A grama é unlit: sem essa modulação ela flutua acima do terreno sombreado
    // e o campo vira um borrão claro.
    const grassBrightness=.46+daylight*.62;this.grassMaterial.color.setRGB(grassBrightness*.96,grassBrightness,grassBrightness*.88);
    if(this.playerRig)this.playerRig.antenna.rotation.z=Math.sin(performance.now()*.004)*.08;
  }

  private emitSnapshot() {
    const position=this.playerBody?.translation()??{x:0,y:0,z:0};
    const interaction=this.nearestChest?`${this.lastGamepadName?"□":"E"} · Guardar ou retirar recursos`:this.nearestResource?this.nearestResource.kind==="berry"?`${this.lastGamepadName?"□":"E"} · Coletar frutos`:`${this.lastGamepadName?"△":"Q"} · Golpear ${this.nearestResource.kind==="wood"?"árvore":"rocha"} · ${this.nearestResource.health}/${this.nearestResource.maxHealth}`:"";const worldState=this.getWorldState();
    const height=terrainHeightAt(position.x,position.z);
    this.callbacks.onSnapshot({health:Math.round(this.health),hunger:Math.round(this.hunger),berries:this.berries,wood:this.wood,stone:this.stone,distance:Math.round(Math.hypot(position.x,position.z)),chunks:this.loadedChunks.size,biome:height>2.6?"Terras Altas":height<-1.8?"Vale Nebuloso":"Campos de Aurora",interaction,selectedSlot:this.selectedSlot,axeDurability:this.axeDurability,pickaxeDurability:this.pickaxeDurability,spearDurability:this.spearDurability,campfireKits:this.campfireKits,timeLabel:worldState.timeLabel,isNight:worldState.isNight,temperature:worldState.temperature,nearFire:worldState.nearFire,survivedNights:this.survivedNights,hammer:this.hammer,buildingPiece:this.buildingDefinition?.name??"",buildingValid:this.buildingValid,sheltered:worldState.sheltered,comboStep:this.comboStep,comboBuffered:this.comboBuffered,gamepad:this.lastGamepadName});
  }

  reset() {
    if(!this.world)return;
    this.health=EMPTY_SNAPSHOT.health; this.hunger=EMPTY_SNAPSHOT.hunger; this.berries=0; this.wood=0; this.stone=0;this.axeDurability=0;this.pickaxeDurability=0;this.spearDurability=0;this.campfireKits=0;this.hammer=false;this.survivalTime=0;this.wasNight=false;this.survivedNights=0;this.respawnPosition=null;
    this.verticalVelocity=0; this.horizontalVelocity.set(0,0,0); this.grounded=false;this.attackTime=0;this.comboStep=0;this.comboBuffered=0;this.comboResetTimer=0;this.attackTarget=null;this.collectedResources.clear();this.resourceDamage.clear();
    const y=terrainHeightAt(0,0)+2.2; this.playerBody.setTranslation({x:0,y,z:0},true); this.playerBody.setNextKinematicTranslation({x:0,y,z:0}); this.player.position.set(0,y-.93+PLAYER_MODEL_GROUND_OFFSET,0);
    this.grassTrail.set(0,y,0);
    this.emitSnapshot();
  }

  setPaused(value:boolean){this.paused=value;if(!value)this.clock.getDelta();}
  selectHotbarSlot(index:number,haptic=false){const next=(index+9)%9;if(next===this.selectedSlot)return;this.selectedSlot=next;if(haptic)this.pulse(.1,28);this.emitSnapshot();}
  applySettings(settings:GameSettings){const grassChanged=this.settings?.grassAmount!==settings.grassAmount;this.settings=settings;if(!this.renderer)return;const ratio=settings.quality==="high"?Math.min(devicePixelRatio,2):settings.quality==="medium"?Math.min(devicePixelRatio,1.5):1;this.renderer.setPixelRatio(ratio);this.renderer.shadowMap.enabled=settings.shadows;this.bloom.enabled=settings.bloom;if(grassChanged)this.rebuildGrass();this.resize();}
  private updateGamepad(){if(!this.settings?.gamepadEnabled)return;const pads=navigator.getGamepads?.()??[];let pad=this.gamepadIndex===null?null:pads[this.gamepadIndex];if(!pad?.connected)pad=Array.from(pads).find(Boolean)??null;this.gamepadIndex=pad?.index??null;const next=new Set<number>();pad?.buttons.forEach((button,index)=>{if(button.pressed||button.value>.55)next.add(index)});for(const index of next)if(!this.gamepadButtons.has(index))this.pressed.add(`pad-${index}`);this.gamepadButtons=next;const name=pad?(/dualsense|wireless controller/i.test(pad.id)?"DualSense conectado":`${pad.id.slice(0,22)} conectado`):"";if(name!==this.lastGamepadName){this.lastGamepadName=name;this.emitSnapshot();}}
  private getPad(){return this.gamepadIndex===null?null:navigator.getGamepads?.()[this.gamepadIndex]??null;}
  private consumePad(index:number){const key=`pad-${index}`;if(!this.pressed.has(key))return false;this.pressed.delete(key);return true;}
  private deadzone(x:number,y:number){const length=Math.hypot(x,y),dead=this.settings.deadzone;if(length<=dead)return{x:0,y:0};const scaled=Math.min(1,(length-dead)/(1-dead));return{x:x/length*scaled,y:y/length*scaled};}
  private pulse(strength:number,duration:number){if(!this.settings.gamepadEnabled||this.settings.vibration<=0)return;const pad=this.getPad() as (Gamepad&{vibrationActuator?:{playEffect?:(type:string,options:Record<string,number>)=>Promise<unknown>}})|null;const actuator=pad?.vibrationActuator;if(!actuator?.playEffect)return;const magnitude=Math.min(1,strength*this.settings.vibration);void actuator.playEffect("dual-rumble",{duration,startDelay:0,strongMagnitude:magnitude,weakMagnitude:magnitude*.65}).catch(()=>undefined);}
  testVibration(){this.pulse(1,220);}
  private resize(){if(!this.renderer)return;const width=this.canvas.clientWidth||innerWidth,height=this.canvas.clientHeight||innerHeight;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);this.composer.setSize(width,height);}
  destroy(){if(this.initialized)this.saveGame();this.destroyed=true;cancelAnimationFrame(this.frame);this.listeners.forEach(listener=>listener());for(const chunk of this.loadedChunks.values()){this.world?.removeCollider(chunk.collider,false);chunk.grass?.dispose();chunk.flowers?.dispose();}this.terrainMaterial.dispose();this.grassGeometry.dispose();this.flowerGeometry.dispose();this.grassMaterial.dispose();disposeFoliageAssets(this.foliage);this.sky.dome.geometry.dispose();(this.sky.dome.material as THREE.Material).dispose();this.sky.range.children.forEach(child=>(child as THREE.Mesh).geometry.dispose());this.sky.rangeMaterials.forEach(material=>material.dispose());this.sky.sun.geometry.dispose();this.sky.sunMaterial.dispose();this.playerMixer?.stopAllAction();if(this.playerRig)this.playerMixer?.uncacheRoot(this.playerRig.group);this.renderer?.dispose();this.composer?.dispose();if(this.world&&this.character)this.world.removeCharacterController(this.character);}
}

export { WORLD_SEED };
