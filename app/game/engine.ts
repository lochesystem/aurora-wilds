import * as THREE from "three";
import RAPIER from "@dimforge/rapier3d-compat";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { animatePlayerModel, createPlayerModel, PLAYER_MODEL_GROUND_OFFSET, setPlayerEquipment, type Equipment, type PlayerRig } from "./models";
import { attackDuration, attackEquipmentForStep, attackImpact, attackStyleFor } from "./attack-pose.js";
import { lerpAngle, stepPlanarVelocity } from "./motion.js";
import type { GameSettings } from "./settings";
import { craftRecipe, getRecipe } from "./crafting.js";
import { BUILDING_PIECES, buildingPlacementBlocked, canBuild, findBuildingSnap, getBuildingPiece, isStructureSupported, snapToGrid, structureRefund, structureRepairCost, unsupportedStructuresAfterRemoval } from "./building.js";
import { normalizeSave, SAVE_KEY, SAVE_VERSION } from "./save-game.js";
import { harvestHit, RESOURCE_HEALTH } from "./harvesting.js";
import { finishCombo, requestCombo } from "./combat-combo.js";
import { FAUNA_STATS, faunaCanAct, faunaForChunk, faunaHitDamage, faunaIntent, nightEventFor } from "./fauna.js";
import { CARRIED_EQUIPMENT_IDS, DEFAULT_EQUIPMENT, DEFAULT_HOTBAR, DEFAULT_WEAPON_SLOTS, assignHotbarItem, normalizeEquipmentSlots, normalizeHotbarSlots, normalizeWeaponSlots, rememberWeapon, setWeaponSlot as assignWeaponSlot } from "./inventory.js";
import { createFlowerField, createFlowerGeometry, createGrassField, createGrassGeometry, createGrassMaterial, updateGrassInteraction } from "./grass";
import { createSky, createToonGradient, PALETTE, skyPalette, updateWind, type SkyRig } from "./art";
import { createBerryBush, createFoliageAssets, createRock, createTree, disposeFoliageAssets, seededRandom, treeVariantFor, type FoliageAssets } from "./foliage";
import { nextDawnAt, worldTimeAt } from "./world-time.js";
import { canStartClimb, stepClimbStamina } from "./climbing.js";
import {
  CHUNK_LOAD_RADIUS,
  CHUNK_SEGMENTS,
  CHUNK_SIZE,
  WATER_LEVEL,
  WORLD_SEED,
  biomeAt,
  chunkKey,
  grassDensityAt,
  grassForChunk,
  grassTuftBudget,
  isWaterAt,
  pointsOfInterestForChunk,
  resourcesForChunk,
  riverCenterAt,
  safeSurfaceReturn,
  terrainHeightAt,
  visibleChunkCoordinates,
  worldToChunk,
} from "./survival-world.js";

export interface GameSnapshot {
  health: number;
  hunger: number;
  berries: number;
  rawMeat: number;
  cookedMeat: number;
  wood: number;
  stone: number;
  distance: number;
  chunks: number;
  biome: string;
  interaction: string;
  selectedSlot: number;
  hotbarSlots: string[];
  equipmentSlots: Record<string,string>;
  weaponSlots: string[];
  coldProtection: number;
  heatProtection: number;
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
  buildingSnap: string;
  buildingIssue: string;
  sheltered: boolean;
  comboStep: number;
  comboBuffered: number;
  gamepad: string;
  nightEvent: string;
  playerX:number;
  playerZ:number;
  heading:number;
  climbStamina:number;
  climbing:boolean;
  underground:boolean;
  mapMarkers:Array<{x:number;z:number;kind:string;looted?:boolean}>;
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
type AnimalKind="grazer"|"boar"|"predator"|"bear"|"golem"|"goblin";
type AnimalObject={id:string;kind:AnimalKind;x:number;y:number;z:number;homeX:number;homeZ:number;heading:number;group:THREE.Group;health:number;maxHealth:number;provoked:number;attackCooldown:number;wanderTimer:number;hitFlash:number;deadTimer:number;phase:number;environment?:"surface"|"cave"};
type AttackTarget=ResourceObject|AnimalObject;
type PoiType="ruin"|"cave"|"camp";
type PoiObject={id:string;type:PoiType;x:number;y:number;z:number;reward:{wood:number;stone:number;berries:number};group:THREE.Group;looted:boolean};
type LoadedChunk = { group: THREE.Group; collider: RAPIER.Collider; resources: ResourceObject[]; animals:AnimalObject[]; pois:PoiObject[]; water:THREE.Mesh|null; grass:THREE.InstancedMesh|null; flowers:THREE.InstancedMesh|null; chunkX:number; chunkZ:number };
type Campfire = { group:THREE.Group; flame:THREE.Mesh; light:THREE.PointLight; position:THREE.Vector3; phase:number };
type BuildingDefinition = (typeof BUILDING_PIECES)[number];
type StructureStorage = {berries:number;wood:number;stone:number};
type Structure = {id:string;group:THREE.Group;position:THREE.Vector3;rotation:number;definition:BuildingDefinition;collider:RAPIER.Collider|null;storage:StructureStorage;health:number;maxHealth:number;open:boolean};
type SavedStructure = {id:string;x:number;y:number;z:number;rotation:number;storage?:StructureStorage;health?:number;open?:boolean};
type PendingBuilding = {definition:BuildingDefinition;position:THREE.Vector3;rotation:number};
type EnemyProjectile={mesh:THREE.Mesh;velocity:THREE.Vector3;life:number;damage:number};
const CAVE_FLOOR_Y=-82;
const CAVE_HALF_SIZE=18;
const CAVE_ENTRY_Z=-16;
const CAVE_CACHE_Z=15;

const EMPTY_SNAPSHOT: GameSnapshot = {
  health: 100, hunger: 78, berries: 0, rawMeat:0, cookedMeat:0, wood: 0, stone: 0,
  distance: 0, chunks: 0, biome: "Campos de Aurora", interaction: "", selectedSlot:0,hotbarSlots:[...DEFAULT_HOTBAR],equipmentSlots:{...DEFAULT_EQUIPMENT},weaponSlots:[...DEFAULT_WEAPON_SLOTS],coldProtection:0,heatProtection:0,
  axeDurability:0,pickaxeDurability:0,spearDurability:0,campfireKits:0,timeLabel:"07:00",isNight:false,temperature:18,nearFire:false,survivedNights:0,
  hammer:false,buildingPiece:"",buildingValid:false,buildingSnap:"",buildingIssue:"",sheltered:false,comboStep:0,comboBuffered:0,gamepad: "",nightEvent:"",
  playerX:0,playerZ:0,heading:0,climbStamina:100,climbing:false,underground:false,mapMarkers:[],
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
  private attackStyle = "jab";
  private attackDuration = 0.36;
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
  private rawMeat = 0;
  private cookedMeat = 0;
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
  private buildingSnap = "";
  private buildingIssue = "";
  private buildingSnapKey = "";
  private pendingBuilding:PendingBuilding|null = null;
  private nearestChest: Structure | null = null;
  private nearestBed: Structure | null = null;
  private nearestStructure: Structure | null = null;
  private nearestPoi:PoiObject|null=null;
  private nearWater=false;
  private fishingCooldown=0;
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
  private nearestAnimal: AnimalObject | null = null;
  private defeatedFauna = new Set<string>();
  private visitedPois=new Set<string>();
  private climbing=false;
  private climbStamina=100;
  private underground=false;
  private caveReturnPosition:THREE.Vector3|null=null;
  private activeCavePoi="";
  private caveGroup:THREE.Group|null=null;
  private caveColliders:RAPIER.Collider[]=[];
  private caveWallBounds:Array<{x:number;z:number;halfWidth:number;halfDepth:number}>=[];
  private caveAnimals:AnimalObject[]=[];
  private caveCache:THREE.Group|null=null;
  private cavePlayerLight:THREE.PointLight|null=null;
  private nearCaveCache=false;
  private nearCaveExit=false;
  private enemyProjectiles:EnemyProjectile[]=[];
  private resourceDamage = new Map<string,number>();
  private resourceDrops: ResourceDrop[] = [];
  private attackTime = 0;
  private attackTarget: AttackTarget | null = null;
  private attackImpactDone = false;
  private attackEquipment:Equipment = "hands";
  private comboStep = 0;
  private comboBuffered = 0;
  private comboResetTimer = 0;
  private equippedVisual = "";
  private selectedSlot = 0;
  private hotbarSlots=[...DEFAULT_HOTBAR];
  private equipmentSlots={...DEFAULT_EQUIPMENT};
  private weaponSlots=[...DEFAULT_WEAPON_SLOTS];
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
    const water=this.createRiverMesh(originX,originZ);if(water)group.add(water);

    const collider = this.world.createCollider(
      RAPIER.ColliderDesc.trimesh(new Float32Array(vertices), new Uint32Array(indices)).setTranslation(originX, 0, originZ),
    );
    const definitions = resourcesForChunk(chunkX, chunkZ) as ResourceDefinition[];
    const resources = definitions
      .filter(resource => !this.collectedResources.has(resource.id))
      .map(resource => {const maxHealth=resource.kind==="berry"?1:RESOURCE_HEALTH[resource.kind];return{...resource,object:this.createResourceObject(resource),maxHealth,health:Math.max(1,maxHealth-(this.resourceDamage.get(resource.id)??0)),hitFlash:0,destroying:0};});
    for (const resource of resources) group.add(resource.object);
    const animals=(faunaForChunk(chunkX,chunkZ,CHUNK_SIZE) as Array<{id:string;kind:AnimalKind;x:number;z:number;heading:number}>)
      .filter(definition=>!this.defeatedFauna.has(definition.id))
      .map((definition,index)=>{const stats=FAUNA_STATS[definition.kind],y=terrainHeightAt(definition.x,definition.z),animalGroup=this.createAnimalModel(definition.kind);animalGroup.position.set(definition.x,y,definition.z);animalGroup.rotation.y=definition.heading;this.scene.add(animalGroup);return{...definition,y,homeX:definition.x,homeZ:definition.z,group:animalGroup,health:stats.health,maxHealth:stats.health,provoked:0,attackCooldown:0,wanderTimer:1.2+index*.7,hitFlash:0,deadTimer:0,phase:index*1.9+chunkX*.4+chunkZ*.7};});
    const pois=(pointsOfInterestForChunk(chunkX,chunkZ) as Array<Omit<PoiObject,"group"|"looted">>).map(definition=>{const poiGroup=this.createPoiModel(definition.type);poiGroup.position.set(definition.x-originX,definition.y,definition.z-originZ);group.add(poiGroup);const poi={...definition,group:poiGroup,looted:this.visitedPois.has(definition.id)};this.setPoiLooted(poi,poi.looted);return poi;});
    this.scene.add(group);
    return { group, collider, resources, animals, pois, water, grass, flowers, chunkX, chunkZ };
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
    const forestTone=new THREE.Color(0x3f7138),highlandTone=new THREE.Color(0x7f8265),riverTone=new THREE.Color(0x55945b);
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
      const biome=biomeAt(worldX,worldZ);if(biome.id==="forest")color.lerp(forestTone,.38);else if(biome.id==="highlands")color.lerp(highlandTone,.36);else if(biome.id==="riverlands")color.lerp(riverTone,.42);
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

  private createRiverMesh(originX:number,originZ:number){
    const centers=[riverCenterAt(originX),riverCenterAt(originX+CHUNK_SIZE/2),riverCenterAt(originX+CHUNK_SIZE)];
    if(Math.max(...centers)<originZ-4||Math.min(...centers)>originZ+CHUNK_SIZE+4)return null;
    const vertices:number[]=[],indices:number[]=[];const segments=8;
    for(let index=0;index<=segments;index+=1){const x=index/segments*CHUNK_SIZE,center=riverCenterAt(originX+x)-originZ;vertices.push(x,WATER_LEVEL,center-3.15,x,WATER_LEVEL,center+3.15);if(index<segments){const a=index*2;indices.push(a,a+2,a+1,a+1,a+2,a+3);}}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute("position",new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const material=new THREE.MeshStandardMaterial({color:0x4dabc4,transparent:true,opacity:.78,roughness:.22,metalness:.05,side:THREE.DoubleSide});const mesh=new THREE.Mesh(geometry,material);mesh.receiveShadow=true;return mesh;
  }

  private createPoiModel(type:PoiType){
    const group=new THREE.Group(),stone=new THREE.MeshToonMaterial({color:0x72786f,gradientMap:this.toonGradient}),wood=new THREE.MeshToonMaterial({color:0x795137,gradientMap:this.toonGradient}),glow=new THREE.MeshStandardMaterial({color:0xffcb67,emissive:0xff8f32,emissiveIntensity:2});
    const box=(size:[number,number,number],position:[number,number,number],material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);};
    if(type==="ruin"){box([3,.35,3],[0,.18,0],stone);box([.45,2.6,.45],[-1.1,1.3,-1],stone);box([.45,1.8,.45],[1.1,.9,-1],stone);box([2.6,.4,.45],[0,2.4,-1],stone);}
    if(type==="cave"){for(const angle of[-1.2,-.72,-.24,.24,.72,1.2]){const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.72,0),stone);rock.position.set(Math.sin(angle)*1.45,.65+Math.cos(angle)*1.35,Math.cos(angle)*.35);rock.scale.set(1,1.2,.8);rock.castShadow=true;group.add(rock);}}
    if(type==="camp"){box([2.5,.15,2],[0,.08,0],wood);box([.12,1.7,.12],[-1.1,.85,-.8],wood);box([.12,1.7,.12],[1.1,.85,-.8],wood);const cloth=new THREE.Mesh(new THREE.ConeGeometry(1.45,1.9,4),new THREE.MeshToonMaterial({color:0xa8784b,gradientMap:this.toonGradient}));cloth.position.y=1;cloth.rotation.y=Math.PI/4;group.add(cloth);}
    const marker=new THREE.Mesh(new THREE.OctahedronGeometry(.16),glow);marker.position.y=type==="cave"?2.7:3;group.add(marker);group.userData.marker=marker;return group;
  }

  private setPoiLooted(poi:PoiObject,looted:boolean){
    poi.looted=looted;const marker=poi.group.userData.marker as THREE.Mesh|undefined;if(!marker)return;
    const material=marker.material as THREE.MeshStandardMaterial;material.color.setHex(looted?0x6f7772:0xffcb67);material.emissive.setHex(looted?0x000000:0xff8f32);material.emissiveIntensity=looted?0:2;marker.scale.setScalar(looted?.72:1);
  }

  private createAnimalModel(kind:AnimalKind){
    if(kind==="golem"||kind==="goblin")return this.createHumanoidEnemyModel(kind);
    const group=new THREE.Group(),isPredator=FAUNA_STATS[kind].behavior==="predator",isBear=kind==="bear",isBoar=kind==="boar";
    const bodyMaterial=new THREE.MeshToonMaterial({color:isBear?0x4b3528:isBoar?0x806247:isPredator?0x59606a:0xb88a56,gradientMap:this.toonGradient});
    const lightMaterial=new THREE.MeshToonMaterial({color:isBear?0x76543b:isPredator?0x87909a:0xe3c48f,gradientMap:this.toonGradient});
    const darkMaterial=new THREE.MeshToonMaterial({color:isPredator?0x242b33:0x563925,gradientMap:this.toonGradient});
    const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=group)=>{const object=new THREE.Mesh(geometry,material);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;};
    const body=mesh(new THREE.SphereGeometry(.72,7,5),bodyMaterial);body.position.y=1.05;body.scale.set(1.18,.72,.72);
    const neck=mesh(new THREE.CylinderGeometry(.28,.4,.68,6),bodyMaterial);neck.position.set(0,1.38,.58);neck.rotation.x=-.45;
    const head=mesh(new THREE.SphereGeometry(.43,7,5),lightMaterial);head.position.set(0,1.65,.86);head.scale.set(.78,.72,1.05);
    const nose=mesh(new THREE.SphereGeometry(.2,6,4),darkMaterial);nose.position.set(0,1.56,1.24);nose.scale.set(.78,.62,1);
    const legs:THREE.Group[]=[];
    for(const x of[-.43,.43])for(const z of[-.38,.42]){const pivot=new THREE.Group();pivot.position.set(x,.78,z);const leg=mesh(new THREE.CylinderGeometry(.09,.075,.72,5),darkMaterial,pivot);leg.position.y=-.35;group.add(pivot);legs.push(pivot);}
    const tailPivot=new THREE.Group();tailPivot.position.set(0,1.22,-.72);const tail=mesh(new THREE.CylinderGeometry(.07,.13,isPredator?.72:.42,5),bodyMaterial,tailPivot);tail.position.z=-(isPredator?.32:.18);tail.rotation.x=Math.PI/2;group.add(tailPivot);
    if(isPredator){for(const x of[-.2,.2]){const ear=mesh(isBear?new THREE.SphereGeometry(.14,6,4):new THREE.ConeGeometry(.14,.38,4),darkMaterial);ear.position.set(x,2,.72);ear.rotation.x=-.18;}}
    else{for(const x of[-.22,.22]){const horn=mesh(new THREE.CylinderGeometry(.035,.055,.48,5),darkMaterial);horn.position.set(x,2.03,.75);horn.rotation.z=x<0?-.22:.22;}}
    group.userData={legs,body,head,tailPivot};group.scale.setScalar(isBear?1.28:isPredator?.88:isBoar?.92:1);return group;
  }

  private createHumanoidEnemyModel(kind:"golem"|"goblin"){
    const group=new THREE.Group(),golem=kind==="golem",bodyMaterial=new THREE.MeshToonMaterial({color:golem?0x687069:0x4d8b45,gradientMap:this.toonGradient}),dark=new THREE.MeshToonMaterial({color:golem?0x3b423e:0x28382a,gradientMap:this.toonGradient}),glow=new THREE.MeshStandardMaterial({color:golem?0xffa93b:0xc9ff72,emissive:golem?0xff6a22:0x5cff44,emissiveIntensity:1.6});
    const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=group)=>{const object=new THREE.Mesh(geometry,material);object.castShadow=object.receiveShadow=true;parent.add(object);return object;};
    const body=mesh(golem?new THREE.DodecahedronGeometry(.78,0):new THREE.BoxGeometry(.72,.9,.48),bodyMaterial);body.position.y=1.25;
    const head=mesh(golem?new THREE.DodecahedronGeometry(.46,0):new THREE.SphereGeometry(.38,6,4),bodyMaterial);head.position.y=2.08;
    for(const x of[-.16,.16]){const eye=mesh(new THREE.SphereGeometry(.055,5,3),glow);eye.position.set(x,2.12,.39);}
    const legs:THREE.Group[]=[];for(const x of[-.3,.3]){const pivot=new THREE.Group();pivot.position.set(x,.88,0);const leg=mesh(new THREE.CylinderGeometry(golem?.18:.11,golem?.22:.13,.85,5),dark,pivot);leg.position.y=-.42;group.add(pivot);legs.push(pivot);}
    for(const x of[-.78,.78]){const arm=mesh(golem?new THREE.DodecahedronGeometry(.34,0):new THREE.CylinderGeometry(.1,.12,.85,5),bodyMaterial);arm.position.set(x,1.35,0);arm.scale.y=golem?1.5:1;}
    const tailPivot=new THREE.Group();group.add(tailPivot);group.userData={legs,body,head,tailPivot};group.scale.setScalar(golem?1.55:.86);return group;
  }

  private syncChunks(force = false) {
    if(this.underground)return;
    const position = this.playerBody?.translation() ?? { x:0, z:0 };
    const centerX = worldToChunk(position.x);
    const centerZ = worldToChunk(position.z);
    const desired = new Set(visibleChunkCoordinates(centerX, centerZ, CHUNK_LOAD_RADIUS).map(({x,z}:{x:number;z:number}) => chunkKey(x,z)));
    if (!force && desired.size === this.loadedChunks.size && [...desired].every(key => this.loadedChunks.has(key))) return;
    for (const [key, chunk] of this.loadedChunks) if (!desired.has(key)) {
      this.scene.remove(chunk.group);
      (chunk.group.children[0] as THREE.Mesh).geometry.dispose();
      chunk.grass?.dispose(); chunk.flowers?.dispose();if(chunk.water){chunk.water.geometry.dispose();(chunk.water.material as THREE.Material).dispose();}for(const poi of chunk.pois)this.disposeGroup(poi.group);
      for(const animal of chunk.animals){this.scene.remove(animal.group);this.disposeGroup(animal.group);}
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
    this.fishingCooldown=Math.max(0,this.fishingCooldown-dt);
    this.updateAttackState(dt);
    const pad=this.getPad(); const left=this.deadzone(pad?.axes[0]??0,pad?.axes[1]??0);
    let mx=left.x,my=left.y;
    if(this.keys.has("a")||this.keys.has("arrowleft"))mx-=1; if(this.keys.has("d")||this.keys.has("arrowright"))mx+=1;
    if(this.keys.has("w")||this.keys.has("arrowup"))my-=1; if(this.keys.has("s")||this.keys.has("arrowdown"))my+=1;
    const inputLength=Math.hypot(mx,my); if(inputLength>1){mx/=inputLength;my/=inputLength;}
    if(pad){const right=this.deadzone(pad.axes[2]??0,pad.axes[3]??0);this.yaw-=right.x*2.2*dt*this.settings.cameraSensitivity;this.pitch+=(this.settings.invertY?-1:1)*right.y*1.8*dt*this.settings.cameraSensitivity;this.pitch=THREE.MathUtils.clamp(this.pitch,.12,1.05);}
    const jump=this.pressed.has(" ")||this.consumePad(0),climbHeld=this.keys.has(" ")||this.gamepadButtons.has(0);
    const forward=new THREE.Vector3(-Math.sin(this.yaw),0,-Math.cos(this.yaw));
    const right=new THREE.Vector3(Math.cos(this.yaw),0,-Math.sin(this.yaw));
    const move=forward.multiplyScalar(-my).add(right.multiplyScalar(mx));
    if(move.lengthSq()>.001){move.normalize();if(!this.attackTarget)this.playerVisual.rotation.y=lerpAngle(this.playerVisual.rotation.y,Math.atan2(move.x,move.z),.2);}
    const bodyPosition=this.playerBody.translation(),aheadX=bodyPosition.x+move.x*1.15,aheadZ=bodyPosition.z+move.z*1.15;
    const rise=this.underground?(Math.max(Math.abs(aheadX)-6,Math.abs(aheadZ)-13)>-.3?1:0):terrainHeightAt(aheadX,aheadZ)-terrainHeightAt(bodyPosition.x,bodyPosition.z);
    this.climbing=canStartClimb({rise,holding:climbHeld,moving:move.lengthSq()>.01,stamina:this.climbStamina,underground:this.underground});
    this.climbStamina=stepClimbStamina(this.climbStamina,dt,this.climbing);
    if(jump&&this.grounded&&!this.climbing){this.verticalVelocity=9.4;this.grounded=false;this.pulse(.3,75);}
    this.verticalVelocity=this.climbing?3.15:this.verticalVelocity-24*dt;
    if(this.attackTarget)this.playerVisual.rotation.y=lerpAngle(this.playerVisual.rotation.y,Math.atan2(this.attackTarget.x-this.player.position.x,this.attackTarget.z-this.player.position.z),.35);
    const attackMovement=this.attackTime>0 ? .34 : 1;
    const sprinting=this.attackTime<=0&&(this.keys.has("shift")||this.gamepadButtons.has(10))&&move.lengthSq()>.01&&this.hunger>2;
    const speedScale=this.climbing?.28:sprinting?1.35:.92;
    const velocity=stepPlanarVelocity({x:this.horizontalVelocity.x,z:this.horizontalVelocity.z},{x:move.x*attackMovement,z:move.z*attackMovement},dt,this.grounded,this.climbing,speedScale);
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
    const attacking=this.attackTime>0;
    const attackProgress=attacking?1-this.attackTime/this.attackDuration:0;
    animatePlayerModel(this.playerRig,animationTime,this.horizontalVelocity.length(),this.grounded,this.verticalVelocity,sprinting,attacking?{style:this.attackStyle,step:this.comboStep,progress:attackProgress}:null,this.climbing);
    if(attacking&&!this.attackImpactDone&&attackProgress>=attackImpact(this.attackStyle)){this.attackImpactDone=true;if(this.attackTarget){if(this.isAnimal(this.attackTarget))this.resolveAnimalHit(this.attackTarget);else this.resolveResourceHit(this.attackTarget);}if(this.pendingBuilding)this.resolveBuildingPlacement();}
    this.syncChunks();
    this.updateAnimals(dt);
    this.updateEnemyProjectiles(dt);
    this.updateNearestResource();
    this.updateNearestAnimal();
    this.updateNearestStructures();
    this.updateNearestExploration();
    this.updateCampfires(dt);
    this.updateResourceAnimations(dt);this.updateResourceDrops(dt);
    const primaryAction=this.pressed.has("q")||this.consumePad(3);
    if(this.buildingDefinition){this.updateBuildingPreview();if(primaryAction)this.placeBuilding();}
    else{
      if(this.pressed.has("e")||this.consumePad(2)){if(this.nearCaveExit)this.exitCave();else if(this.nearCaveCache)this.claimCaveCache();else if(this.nearestPoi)this.claimPoi(this.nearestPoi);else if(this.nearestChest)this.interactChest(this.nearestChest);else if(this.nearestStructure?.id==="door")this.toggleDoor(this.nearestStructure);else if(this.nearestResource?.kind==="berry")this.collect(this.nearestResource);else if(this.nearestResource)this.callbacks.onToast("Golpeie o recurso para extrair material");else if(this.rawMeat>0&&this.getWorldState().nearFire)this.cookMeat();else if(this.nearWater)this.fish();}
      if(this.pressed.has("f")||this.consumePad(1))this.sleepUntilDawn();
      if((this.pressed.has("x")||this.consumePad(11))&&this.nearestStructure)this.dismantleStructure(this.nearestStructure);
      if(primaryAction&&!this.climbing){if(this.currentEquipment()==="hammer"&&this.nearestStructure)this.repairStructure(this.nearestStructure);else if(this.nearestAnimal)this.attackAnimal(this.nearestAnimal);else if(this.nearestResource&&this.nearestResource.kind!=="berry")this.attackResource(this.nearestResource);else this.useSelectedItem();}
    }
    this.hunger=Math.max(0,this.hunger-dt*(sprinting?.2:.11));
    const worldState=this.getWorldState();
    if(worldState.isNight&&!this.wasNight){const event=nightEventFor(this.survivedNights+1);this.spawnNightRaid(event.id);this.callbacks.onToast(`${event.name} — predadores atacarão o acampamento`);}
    if(!worldState.isNight&&this.wasNight){this.survivedNights+=1;this.callbacks.onToast(this.survivedNights===1?"Primeiro amanhecer alcançado!":"Você sobreviveu a mais uma noite");}
    this.wasNight=worldState.isNight;
    if(this.hunger<=0){this.health=Math.max(0,this.health-dt*5);if(this.hurtCooldown<=0){this.hurtCooldown=1;this.callbacks.onDamage();}}
    if(worldState.temperature<5){this.health=Math.max(0,this.health-dt*2.6);if(this.hurtCooldown<=0){this.hurtCooldown=1;this.callbacks.onDamage();}}
    else if(this.hunger>70&&this.health<100)this.health=Math.min(100,this.health+dt*.6);
    if((!this.underground&&position.y<terrainHeightAt(position.x,position.z)-12)||position.y<CAVE_FLOOR_Y-10||this.health<=0){this.handleDefeat();return;}
    this.updateCamera(dt); this.updateAmbient();
    this.snapshotTimer-=dt; if(this.snapshotTimer<=0){this.snapshotTimer=.14;this.emitSnapshot();}
    this.saveTimer-=dt;if(this.saveTimer<=0){this.saveTimer=4;this.saveGame();}
  }

  private updateNearestResource() {
    if(this.underground){this.nearestResource=null;return;}
    let nearest:ResourceObject|null=null; let nearestDistance=2.35;
    for(const chunk of this.loadedChunks.values())for(const resource of chunk.resources){if(!resource.object.visible||resource.destroying>0)continue;const distance=Math.hypot(this.player.position.x-resource.x,this.player.position.z-resource.z);if(distance<nearestDistance){nearest=resource;nearestDistance=distance;}}
    this.nearestResource=nearest;
  }

  private updateNearestAnimal(){
    let nearest:AnimalObject|null=null,nearestDistance=this.currentEquipment()==="spear"?3.35:2.2;
    const populations=this.underground?[this.caveAnimals]:[...this.loadedChunks.values()].map(chunk=>chunk.animals);
    for(const animals of populations)for(const animal of animals){if(!faunaCanAct({visible:animal.group.visible,health:animal.health,deadTimer:animal.deadTimer}))continue;const distance=Math.hypot(this.player.position.x-animal.x,this.player.position.z-animal.z);if(distance<nearestDistance){nearest=animal;nearestDistance=distance;}}
    this.nearestAnimal=nearest;
  }

  private isAnimal(target:AttackTarget):target is AnimalObject{return target.kind in FAUNA_STATS;}

  private updateAnimals(dt:number){
    const playerX=this.player.position.x,playerZ=this.player.position.z,time=performance.now()*.001,worldState=this.getWorldState(),nightEvent=nightEventFor(this.survivedNights+1),danger=worldState.isNight?nightEvent.dangerMultiplier:1;
    const populations=this.underground?[this.caveAnimals]:[...this.loadedChunks.values()].map(chunk=>chunk.animals);
    for(const animals of populations)for(const animal of animals){
      if(animal.deadTimer>0){animal.deadTimer=Math.max(0,animal.deadTimer-dt);animal.group.rotation.z=THREE.MathUtils.lerp(animal.group.rotation.z,-Math.PI/2,.12);animal.group.scale.multiplyScalar(Math.max(.82,1-dt*.5));if(animal.deadTimer<=0)animal.group.visible=false;continue;}
      if(!faunaCanAct({visible:animal.group.visible,health:animal.health,deadTimer:animal.deadTimer}))continue;
      animal.provoked=Math.max(0,animal.provoked-dt);animal.attackCooldown=Math.max(0,animal.attackCooldown-dt);animal.wanderTimer-=dt;animal.hitFlash=Math.max(0,animal.hitFlash-dt);
      const stats=FAUNA_STATS[animal.kind],dx=playerX-animal.x,dz=playerZ-animal.z,distance=Math.hypot(dx,dz),entranceSafe=animal.kind==="goblin"&&this.underground&&playerZ< -9,intent=entranceSafe?"wander":faunaIntent(animal.kind,distance,animal.provoked>0);
      let structureTarget:Structure|null=null,structureDistance=12;if(worldState.isNight&&stats.behavior==="predator")for(const structure of this.structures){if(!["foundation","wall","door"].includes(structure.id))continue;const next=Math.hypot(animal.x-structure.position.x,animal.z-structure.position.z);if(next<structureDistance){structureTarget=structure;structureDistance=next;}}
      const targetingStructure=Boolean(structureTarget&&structureDistance<distance+2);
      let directionX=Math.sin(animal.heading),directionZ=Math.cos(animal.heading),speed=entranceSafe?0:.45;
      if(targetingStructure&&structureTarget){const targetDx=structureTarget.position.x-animal.x,targetDz=structureTarget.position.z-animal.z;directionX=targetDx/Math.max(.01,structureDistance);directionZ=targetDz/Math.max(.01,structureDistance);speed=structureDistance<1.45?0:stats.speed*danger;if(structureDistance<1.55&&animal.attackCooldown<=0){animal.attackCooldown=1.2;this.damageStructure(structureTarget,Math.round(7*danger),stats.name);}}
      else if(intent==="flee"){directionX=-dx/Math.max(.01,distance);directionZ=-dz/Math.max(.01,distance);speed=stats.speed;}
      else if(intent==="chase"||intent==="attack"){directionX=dx/Math.max(.01,distance);directionZ=dz/Math.max(.01,distance);speed=intent==="attack"?0:stats.speed*danger;}
      else if(!entranceSafe&&animal.wanderTimer<=0){const homeAngle=Math.atan2(animal.homeX-animal.x,animal.homeZ-animal.z),farHome=Math.hypot(animal.x-animal.homeX,animal.z-animal.homeZ)>10;animal.heading=farHome?homeAngle:animal.heading+Math.sin(animal.phase+time*.37)*1.7;animal.wanderTimer=1.8+(Math.sin(animal.phase*4.1)+1)*1.2;directionX=Math.sin(animal.heading);directionZ=Math.cos(animal.heading);}
      if(animal.kind==="golem"&&distance<18&&distance>3&&animal.attackCooldown<=0){animal.attackCooldown=3.8;this.throwGolemBoulder(animal);}
      else if(!targetingStructure&&intent==="attack"&&animal.attackCooldown<=0){animal.attackCooldown=animal.kind==="golem"?2:1.15;this.health=Math.max(0,this.health-stats.damage*danger);this.hurtCooldown=.55;this.callbacks.onDamage();this.callbacks.onToast(`${stats.name} atacou você`);this.pulse(.72,145);}
      const nextX=animal.x+directionX*speed*dt,nextZ=animal.z+directionZ*speed*dt;const caveBlocked=this.underground&&(Math.abs(nextX)>CAVE_HALF_SIZE-1.2||Math.abs(nextZ)>CAVE_HALF_SIZE-1.2||this.caveWallBounds.some(wall=>Math.abs(nextX-wall.x)<wall.halfWidth+.42&&Math.abs(nextZ-wall.z)<wall.halfDepth+.42)),blocked=this.underground?caveBlocked:isWaterAt(nextX,nextZ);if(!blocked){animal.x=nextX;animal.z=nextZ;}else animal.heading+=1.4;
      animal.y=this.underground?CAVE_FLOOR_Y+.02:terrainHeightAt(animal.x,animal.z);animal.heading=lerpAngle(animal.heading,Math.atan2(directionX,directionZ),.13);animal.group.position.set(animal.x,animal.y,animal.z);animal.group.rotation.y=animal.heading;
      const rig=animal.group.userData,pace=time*(speed>2?9:3.2)+animal.phase;for(let index=0;index<rig.legs.length;index+=1)rig.legs[index].rotation.x=Math.sin(pace+(index%2?Math.PI:0))*(speed>2?.62:.18);rig.body.position.y=1.05+Math.sin(pace*2)*.035;rig.head.rotation.x=intent==="attack"?-.35:Math.sin(time*.8+animal.phase)*.07;rig.tailPivot.rotation.y=Math.sin(time*5+animal.phase)*.35;
      animal.group.traverse(object=>{if(object instanceof THREE.Mesh)(object.material as THREE.MeshToonMaterial).emissive?.setHex(animal.hitFlash>0?0x7b1717:0x000000);});
    }
  }

  private throwGolemBoulder(animal:AnimalObject){
    const mesh=new THREE.Mesh(new THREE.DodecahedronGeometry(.55,0),new THREE.MeshToonMaterial({color:0x4f5651,gradientMap:this.toonGradient}));mesh.castShadow=true;mesh.position.set(animal.x,animal.y+2.6,animal.z);this.scene.add(mesh);
    const target=new THREE.Vector3(this.player.position.x,this.player.position.y+1,this.player.position.z),direction=target.sub(mesh.position),travel=Math.max(.8,direction.length()/7);const velocity=new THREE.Vector3(direction.x/travel,direction.y/travel+4.9,direction.z/travel);this.enemyProjectiles.push({mesh,velocity,life:5,damage:FAUNA_STATS.golem.damage});this.callbacks.onToast("O golem arremessou uma rocha!");
  }

  private updateEnemyProjectiles(dt:number){
    const floor=this.underground?CAVE_FLOOR_Y:undefined;
    for(let index=this.enemyProjectiles.length-1;index>=0;index-=1){const projectile=this.enemyProjectiles[index];projectile.life-=dt;projectile.velocity.y-=9.8*dt;projectile.mesh.position.addScaledVector(projectile.velocity,dt);projectile.mesh.rotation.x+=dt*5;projectile.mesh.rotation.z+=dt*3;
      const hit=Math.hypot(projectile.mesh.position.x-this.player.position.x,projectile.mesh.position.z-this.player.position.z)<.8&&Math.abs(projectile.mesh.position.y-(this.player.position.y+1))<1.3;const groundY=floor??terrainHeightAt(projectile.mesh.position.x,projectile.mesh.position.z);
      if(hit){this.health=Math.max(0,this.health-projectile.damage);this.callbacks.onDamage();this.callbacks.onToast("A rocha do golem acertou você");this.pulse(1,210);projectile.life=0;}
      if(projectile.life<=0||projectile.mesh.position.y<groundY){this.scene.remove(projectile.mesh);projectile.mesh.geometry.dispose();(projectile.mesh.material as THREE.Material).dispose();this.enemyProjectiles.splice(index,1);}
    }
  }

  private spawnNightRaid(eventId:string){
    const position=this.player.position,count=eventId==="bloodMoon"?3:eventId==="pack"?2:1,chunkX=worldToChunk(position.x),chunkZ=worldToChunk(position.z),chunk=this.loadedChunks.get(chunkKey(chunkX,chunkZ));if(!chunk)return;
    for(let index=0;index<count;index+=1){const id=`raid:${this.survivedNights+1}:${index}`;if(this.defeatedFauna.has(id)||chunk.animals.some(animal=>animal.id===id))continue;const angle=index/count*Math.PI*2+1.1;let x=position.x+Math.sin(angle)*(14+index*2),z=position.z+Math.cos(angle)*(14+index*2);if(isWaterAt(x,z))z=riverCenterAt(x)+(z<riverCenterAt(x)?-5:5);const kind:AnimalKind=eventId==="bloodMoon"&&index===0?"bear":"predator",stats=FAUNA_STATS[kind],y=terrainHeightAt(x,z),group=this.createAnimalModel(kind);group.position.set(x,y,z);this.scene.add(group);chunk.animals.push({id,kind,x,y,z,homeX:x,homeZ:z,heading:angle+Math.PI,group,health:stats.health,maxHealth:stats.health,provoked:30,attackCooldown:1,wanderTimer:0,hitFlash:0,deadTimer:0,phase:index*1.7});}
  }

  private updateNearestStructures(){
    if(this.underground){this.nearestChest=null;this.nearestBed=null;this.nearestStructure=null;return;}
    let chest:Structure|null=null,bed:Structure|null=null,nearest:Structure|null=null,chestDistance=2.5,bedDistance=2.8,nearestDistance=3;
    for(const structure of this.structures){
      const distance=Math.hypot(this.player.position.x-structure.position.x,this.player.position.z-structure.position.z);
      if(structure.id==="chest"&&distance<chestDistance){chest=structure;chestDistance=distance;}
      if(structure.id==="bed"&&distance<bedDistance){bed=structure;bedDistance=distance;}
      if(distance<nearestDistance){nearest=structure;nearestDistance=distance;}
    }
    this.nearestChest=chest;this.nearestBed=bed;this.nearestStructure=nearest;
  }

  private updateNearestExploration(){
    if(this.underground){this.nearWater=false;this.nearestPoi=null;this.nearCaveExit=Math.hypot(this.player.position.x,this.player.position.z-CAVE_ENTRY_Z)<2.2;this.nearCaveCache=Math.hypot(this.player.position.x,this.player.position.z-CAVE_CACHE_Z)<2.1&&!this.visitedPois.has(this.activeCavePoi);return;}
    this.nearCaveExit=false;this.nearCaveCache=false;
    this.nearWater=isWaterAt(this.player.position.x,this.player.position.z)&&Math.abs(this.player.position.y-WATER_LEVEL)<3||Math.abs(this.player.position.z-riverCenterAt(this.player.position.x))<5.2;
    let nearest:PoiObject|null=null,distance=3.2;for(const chunk of this.loadedChunks.values())for(const poi of chunk.pois){if(poi.looted&&poi.type!=="cave")continue;const next=Math.hypot(this.player.position.x-poi.x,this.player.position.z-poi.z);if(next<distance){nearest=poi;distance=next;}}this.nearestPoi=nearest;
  }

  private fish(){if(this.fishingCooldown>0){this.callbacks.onToast("Aguarde a água se acalmar");return;}this.fishingCooldown=9;this.rawMeat+=1;this.callbacks.onToast("Peixe do rio capturado · alimento cru +1");this.pulse(.26,80);this.saveGame();this.emitSnapshot();}

  private claimPoi(poi:PoiObject){
    if(poi.type==="cave"){this.enterCave(poi);return;}
    if(poi.looted){this.callbacks.onToast("Este local já foi saqueado");return;}
    this.wood+=poi.reward.wood;this.stone+=poi.reward.stone;this.berries+=poi.reward.berries;this.visitedPois.add(poi.id);this.setPoiLooted(poi,true);this.nearestPoi=null;const name=poi.type==="ruin"?"Ruína antiga":"Acampamento abandonado";this.callbacks.onToast(`${name} · recompensa coletada`);this.pulse(.5,120);this.saveGame();this.emitSnapshot();
  }

  private enterCave(poi:PoiObject){
    if(this.underground)return;const body=this.playerBody.translation();this.caveReturnPosition=new THREE.Vector3(body.x,body.y,body.z);this.activeCavePoi=poi.id;this.underground=true;this.clearEnemyProjectiles();
    for(const chunk of this.loadedChunks.values()){chunk.group.visible=false;for(const animal of chunk.animals)animal.group.visible=false;}for(const structure of this.structures)structure.group.visible=false;for(const fire of this.campfires)fire.group.visible=false;
    this.setupCave();const destination={x:0,y:CAVE_FLOOR_Y+2,z:CAVE_ENTRY_Z+1.6};this.playerBody.setTranslation(destination,true);this.playerBody.setNextKinematicTranslation(destination);this.horizontalVelocity.set(0,0,0);this.verticalVelocity=0;this.callbacks.onToast("Você desceu às profundezas · encontre o tesouro no labirinto");this.pulse(.45,150);this.emitSnapshot();
  }

  private setupCave(){
    this.disposeCave();const group=new THREE.Group(),rock=new THREE.MeshToonMaterial({color:0x56625f,gradientMap:this.toonGradient}),ground=new THREE.MeshToonMaterial({color:0x46534e,gradientMap:this.toonGradient}),crystal=new THREE.MeshStandardMaterial({color:0x8af5eb,emissive:0x35b9ba,emissiveIntensity:2.8});
    const box=(size:[number,number,number],position:[number,number,number],material:THREE.Material)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);return mesh;};
    box([CAVE_HALF_SIZE*2,.5,CAVE_HALF_SIZE*2],[0,CAVE_FLOOR_Y-.25,0],ground);
    this.caveColliders.push(this.world.createCollider(RAPIER.ColliderDesc.cuboid(CAVE_HALF_SIZE,.25,CAVE_HALF_SIZE).setTranslation(0,CAVE_FLOOR_Y-.25,0)));
    const addWall=(width:number,depth:number,x:number,z:number,height=5.8)=>{box([width,height,depth],[x,CAVE_FLOOR_Y+height/2, z],rock);this.caveWallBounds.push({x,z,halfWidth:width/2,halfDepth:depth/2});this.caveColliders.push(this.world.createCollider(RAPIER.ColliderDesc.cuboid(width/2,height/2,depth/2).setTranslation(x,CAVE_FLOOR_Y+height/2,z)));};
    addWall(CAVE_HALF_SIZE*2,1,0,-CAVE_HALF_SIZE);addWall(CAVE_HALF_SIZE*2,1,0,CAVE_HALF_SIZE);addWall(1,CAVE_HALF_SIZE*2,-CAVE_HALF_SIZE,0);addWall(1,CAVE_HALF_SIZE*2,CAVE_HALF_SIZE,0);
    // Quatro travessias alternadas obrigam o jogador a ler o espaço e
    // transformam a sala em um percurso sinuoso, com pequenos becos laterais.
    for(const [width,depth,x,z] of [[10,.7,-12,-10],[20,.7,6,-10],[24,.7,-5,-3],[8,.7,13,-3],[10,.7,-12,4],[20,.7,5,4],[26,.7,-4,11],[6,.7,14,11],[.7,5,0,-6.5],[.7,5,-11,.5],[.7,5,12,7.5]] as Array<[number,number,number,number]>)addWall(width,depth,x,z,4.4);
    for(const [x,z] of [[-6,-13],[10,-7],[-13,-1],[8,2],[-9,8],[11,14]] as Array<[number,number]>){const shard=new THREE.Mesh(new THREE.ConeGeometry(.3,1.7,5),crystal);shard.position.set(x,CAVE_FLOOR_Y+.85,z);group.add(shard);const light=new THREE.PointLight(0x55d9d7,2,9);light.position.set(x,CAVE_FLOOR_Y+1.7,z);group.add(light);}
    const torchWood=new THREE.MeshToonMaterial({color:0x6c4933,gradientMap:this.toonGradient}),torchFlame=new THREE.MeshStandardMaterial({color:0xffdc86,emissive:0xff762f,emissiveIntensity:5.2,roughness:.2});
    const addTorch=(x:number,z:number)=>{const torch=new THREE.Group();torch.position.set(x,CAVE_FLOOR_Y+2.35,z);const handle=new THREE.Mesh(new THREE.CylinderGeometry(.055,.07,.72,6),torchWood);handle.rotation.z=Math.PI/2;torch.add(handle);const flame=new THREE.Mesh(new THREE.ConeGeometry(.16,.48,7),torchFlame.clone());flame.position.y=.42;torch.add(flame);const light=new THREE.PointLight(0xffa65c,5.2,15,1.25);light.position.y=.65;torch.add(light);group.add(torch);};
    for(const [x,z] of [[-15,-14],[15,-14],[-6,-9],[8,-7],[8,-2],[-8,0],[-8,5],[10,6],[10,12],[-8,14]] as Array<[number,number]>)addTorch(x,z);
    group.add(new THREE.AmbientLight(0x91aaa5,1.45));const caveFill=new THREE.DirectionalLight(0xb5d2cb,1.1);caveFill.position.set(-4,CAVE_FLOOR_Y+10,-5);group.add(caveFill);
    this.cavePlayerLight=new THREE.PointLight(0xffd4a3,3.4,16,1.15);this.cavePlayerLight.position.set(0,2.1,.8);this.player.add(this.cavePlayerLight);
    const exit=new THREE.Mesh(new THREE.TorusGeometry(1.1,.18,6,12),crystal);exit.position.set(0,CAVE_FLOOR_Y+1.2,CAVE_ENTRY_Z);group.add(exit);
    const cache=new THREE.Group(),chest=box([1.4,.7,.9],[0,CAVE_FLOOR_Y+.35,CAVE_CACHE_Z],rock);group.remove(chest);cache.add(chest);const beacon=new THREE.Mesh(new THREE.OctahedronGeometry(.22),crystal.clone());beacon.position.set(0,CAVE_FLOOR_Y+1.45,CAVE_CACHE_Z);cache.add(beacon);group.add(cache);this.caveCache=cache;if(this.visitedPois.has(this.activeCavePoi)){const mat=beacon.material as THREE.MeshStandardMaterial;mat.emissiveIntensity=0;mat.color.setHex(0x66706d);}
    this.scene.add(group);this.caveGroup=group;
    const enemyPositions=[[-2,-7],[11,-6],[-13,0],[10,1],[-10,8],[12,14]] as Array<[number,number]>;this.caveAnimals=[];for(let index=0;index<enemyPositions.length;index+=1){const id=`${this.activeCavePoi}:goblin:${index}`;if(this.defeatedFauna.has(id))continue;const [x,z]=enemyPositions[index],model=this.createAnimalModel("goblin"),stats=FAUNA_STATS.goblin;model.position.set(x,CAVE_FLOOR_Y,z);this.scene.add(model);this.caveAnimals.push({id,kind:"goblin",x,y:CAVE_FLOOR_Y,z,homeX:x,homeZ:z,heading:index,group:model,health:stats.health,maxHealth:stats.health,provoked:0,attackCooldown:index*.4,wanderTimer:2,hitFlash:0,deadTimer:0,phase:index*1.7,environment:"cave"});}
  }

  private claimCaveCache(){
    if(this.visitedPois.has(this.activeCavePoi))return;this.visitedPois.add(this.activeCavePoi);this.wood+=5;this.stone+=9;this.berries+=3;if(this.caveCache){const marker=this.caveCache.children[1] as THREE.Mesh,material=marker.material as THREE.MeshStandardMaterial;material.emissiveIntensity=0;material.color.setHex(0x66706d);}this.nearCaveCache=false;this.callbacks.onToast("Tesouro das profundezas · madeira +5, pedra +9, frutos +3");this.pulse(.65,180);this.saveGame();this.emitSnapshot();
  }

  private exitCave(){
    if(!this.underground)return;const saved=this.caveReturnPosition??new THREE.Vector3(0,0,0),safe=safeSurfaceReturn(saved.x,saved.z,saved.y),destination=new THREE.Vector3(safe.x,safe.y,safe.z);this.disposeCave();this.underground=false;this.activeCavePoi="";this.caveReturnPosition=null;for(const chunk of this.loadedChunks.values()){chunk.group.visible=true;for(const animal of chunk.animals)animal.group.visible=animal.health>0&&animal.deadTimer<=0;}for(const structure of this.structures)structure.group.visible=true;for(const fire of this.campfires)fire.group.visible=true;for(const chunk of this.loadedChunks.values())for(const poi of chunk.pois)if(this.visitedPois.has(poi.id))this.setPoiLooted(poi,true);this.playerBody.setTranslation(destination,true);this.playerBody.setNextKinematicTranslation(destination);this.player.position.set(destination.x,destination.y-.93+PLAYER_MODEL_GROUND_OFFSET,destination.z);this.verticalVelocity=0;this.horizontalVelocity.set(0,0,0);this.grounded=false;this.hurtCooldown=1.2;this.callbacks.onToast("Você retornou à superfície");this.syncChunks(true);this.saveGame();this.emitSnapshot();
  }

  private disposeCave(){if(this.cavePlayerLight){this.player.remove(this.cavePlayerLight);this.cavePlayerLight.dispose();this.cavePlayerLight=null;}if(this.caveGroup){this.scene.remove(this.caveGroup);this.disposeGroup(this.caveGroup);this.caveGroup=null;}for(const animal of this.caveAnimals){this.scene.remove(animal.group);this.disposeGroup(animal.group);}this.caveAnimals=[];for(const collider of this.caveColliders)this.world.removeCollider(collider,false);this.caveColliders=[];this.caveWallBounds=[];this.caveCache=null;this.nearCaveCache=false;this.nearCaveExit=false;this.clearEnemyProjectiles();}
  private clearEnemyProjectiles(){for(const projectile of this.enemyProjectiles){this.scene.remove(projectile.mesh);projectile.mesh.geometry.dispose();(projectile.mesh.material as THREE.Material).dispose();}this.enemyProjectiles=[];}

  private interactChest(chest:Structure){
    const storage=chest.storage;const carried=this.berries+this.wood+this.stone;
    if(carried>0){storage.berries+=this.berries;storage.wood+=this.wood;storage.stone+=this.stone;this.berries=0;this.wood=0;this.stone=0;this.callbacks.onToast("Recursos guardados no baú");}
    else if(storage.berries+storage.wood+storage.stone>0){this.berries+=storage.berries;this.wood+=storage.wood;this.stone+=storage.stone;storage.berries=0;storage.wood=0;storage.stone=0;this.callbacks.onToast("Recursos retirados do baú");}
    else this.callbacks.onToast("O baú está vazio");this.saveGame();this.emitSnapshot();
  }

  private sleepUntilDawn(){
    const worldState=this.getWorldState();
    if(!this.nearestBed&&!worldState.nearFire){this.callbacks.onToast("Aproxime-se de uma cama ou fogueira para dormir");return;}
    if(!worldState.isNight){this.callbacks.onToast("Ainda está claro — descanse quando a noite chegar");return;}
    this.survivalTime=nextDawnAt(this.survivalTime);this.health=Math.min(100,this.health+18);this.hunger=Math.max(0,this.hunger-6);
    this.callbacks.onToast(this.nearestBed?"Você dormiu na cama até o amanhecer":"Você descansou junto à fogueira até o amanhecer");
    this.pulse(.45,180);this.saveGame();this.emitSnapshot();
  }

  private collect(resource: ResourceObject) {
    resource.object.visible=false; this.collectedResources.add(resource.id); this.nearestResource=null;
    if(resource.kind==="berry"){this.berries+=2;this.callbacks.onToast("Frutos solares +2");}
    this.pulse(.24,60); this.emitSnapshot();
  }

  private currentEquipment(){
    const item=this.hotbarSlots[this.selectedSlot];
    if(item==="axe"&&this.axeDurability>0)return"axe" as const;
    if(item==="pickaxe"&&this.pickaxeDurability>0)return"pickaxe" as const;
    if(item==="hammer"&&this.hammer)return"hammer" as const;
    if(item==="spear"&&this.spearDurability>0)return"spear" as const;
    return"hands" as const;
  }

  private ownsEquipment(item:string){return item==="axe"?this.axeDurability>0:item==="pickaxe"?this.pickaxeDurability>0:item==="hammer"?this.hammer:item==="spear"?this.spearDurability>0:false;}
  private carriedEquipment(){return this.weaponSlots.filter(item=>this.ownsEquipment(item)) as Equipment[];}
  private updateEquippedVisual(){const comboHolding=this.attackTime>0||this.comboResetTimer>0||this.comboBuffered>0;const equipped=comboHolding?this.attackEquipment:this.currentEquipment(),carried=this.carriedEquipment();const key=`${equipped}:${carried.join(",")}`;if(key===this.equippedVisual)return;this.equippedVisual=key;setPlayerEquipment(this.playerRig,equipped,carried);}

  private updateAttackState(dt:number){
    const wasAttacking=this.attackTime>0;this.attackTime=Math.max(0,this.attackTime-dt);
    if(wasAttacking&&this.attackTime<=0){
      const next=finishCombo({step:this.comboStep,buffered:this.comboBuffered});this.comboStep=next.step;this.comboBuffered=next.buffered;
      if(next.startStep)this.beginComboStep(next.startStep,this.attackTarget);else this.comboResetTimer=.34;
    }else if(this.attackTime<=0&&this.comboResetTimer>0){this.comboResetTimer=Math.max(0,this.comboResetTimer-dt);if(this.comboResetTimer<=0){this.comboStep=0;this.comboBuffered=0;this.attackTarget=null;}}
  }

  private beginComboStep(step:number,target:AttackTarget|null){
    this.attackStyle=attackStyleFor(this.attackEquipment);
    this.attackDuration=attackDuration(this.attackStyle,step);
    this.comboStep=step;this.attackTime=this.attackDuration;this.comboResetTimer=0;this.attackTarget=target;this.attackImpactDone=false;
  }

  private startAttack(target:AttackTarget|null=null){
    const next=requestCombo({step:this.comboStep,buffered:this.comboBuffered,active:this.attackTime>0,windowOpen:this.comboResetTimer>0});this.comboStep=next.step;this.comboBuffered=next.buffered;
    if(target)this.attackTarget=target;if(next.startStep){this.attackEquipment=attackEquipmentForStep(this.currentEquipment(),this.attackEquipment,next.startStep);this.beginComboStep(next.startStep,target??this.attackTarget);}return true;
  }

  private startToolUse(equipment:Equipment){
    this.attackTime=0;this.comboStep=0;this.comboBuffered=0;this.comboResetTimer=0;this.attackTarget=null;this.attackEquipment=equipment;this.beginComboStep(1,null);
  }

  private attackResource(resource:ResourceObject){
    if(!this.startAttack(resource))return;
    this.playerVisual.rotation.y=Math.atan2(resource.x-this.player.position.x,resource.z-this.player.position.z);
  }

  private attackAnimal(animal:AnimalObject){
    if(!this.startAttack(animal))return;
    animal.provoked=8;this.playerVisual.rotation.y=Math.atan2(animal.x-this.player.position.x,animal.z-this.player.position.z);
  }

  private resolveAnimalHit(animal:AnimalObject){
    if(animal.deadTimer>0||!animal.group.visible)return;
    const distance=Math.hypot(this.player.position.x-animal.x,this.player.position.z-animal.z),range=this.attackEquipment==="spear"?3.65:2.45;if(distance>range)return;
    const damage=faunaHitDamage(this.attackEquipment,this.comboStep);animal.health=Math.max(0,animal.health-damage);animal.hitFlash=.18;animal.provoked=10;
    if(this.attackEquipment==="spear")this.spearDurability=Math.max(0,this.spearDurability-1);
    if(animal.health<=0){const meat=FAUNA_STATS[animal.kind].meat;animal.deadTimer=.85;this.defeatedFauna.add(animal.id);this.rawMeat+=meat;this.nearestAnimal=null;this.attackTarget=null;this.spawnMeatDrops(animal,meat);if(animal.kind==="golem"){this.stone+=7;this.callbacks.onToast("Golem destruído · pedra +7");}else this.callbacks.onToast(`${FAUNA_STATS[animal.kind].name} abatido · carne crua +${meat}`);this.pulse(.65,130);}
    else{this.callbacks.onToast(`${FAUNA_STATS[animal.kind].name} · ${animal.health}/${animal.maxHealth}`);this.pulse(this.attackEquipment==="spear"?.48:.3,90);}
    this.saveGame();this.emitSnapshot();
  }

  private spawnMeatDrops(animal:AnimalObject,amount:number){
    for(let index=0;index<amount;index+=1){const mesh=new THREE.Mesh(new THREE.SphereGeometry(.18,6,4),new THREE.MeshToonMaterial({color:0xb44743,gradientMap:this.toonGradient}));mesh.scale.set(1.25,.65,.9);mesh.position.set(animal.x,animal.y+.85,animal.z);this.scene.add(mesh);this.resourceDrops.push({mesh,velocity:new THREE.Vector3((index-(amount-1)/2)*1.1,2.6,index%2?.8:-.8),life:.85});}
  }

  private resolveResourceHit(resource:ResourceObject){
    if(resource.destroying>0||!resource.object.visible||Math.hypot(this.player.position.x-resource.x,this.player.position.z-resource.z)>2.8)return;
    const equipped=this.attackEquipment;const result=harvestHit(resource.kind,resource.health,equipped);
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

  private eatProvisions(){
    if(this.cookedMeat>0){if(this.hunger>=99&&this.health>=99){this.callbacks.onToast("Você já está saciado");return;}this.cookedMeat-=1;this.hunger=Math.min(100,this.hunger+42);this.health=Math.min(100,this.health+8);this.callbacks.onToast("Carne assada consumida · fome e vida restauradas");this.pulse(.2,55);this.saveGame();this.emitSnapshot();return;}
    this.eatBerry();
  }

  private cookMeat(){
    if(this.rawMeat<=0)return;this.rawMeat-=1;this.cookedMeat+=1;this.callbacks.onToast("Carne assada na fogueira");this.pulse(.22,65);this.saveGame();this.emitSnapshot();
  }

  private useSelectedItem() {
    const item=this.hotbarSlots[this.selectedSlot];
    if(item==="provisions"){this.eatProvisions();return;}
    if(item==="hands"){this.startAttack();return;}
    if(item==="axe"){if(this.axeDurability>0)this.startAttack();else this.callbacks.onToast("Fabrique um machado no inventário");return;}
    if(item==="pickaxe"){if(this.pickaxeDurability>0)this.startAttack();else this.callbacks.onToast("Fabrique uma picareta no inventário");return;}
    if(item==="campfire"){this.placeCampfire();return;}
    if(item==="wood"||item==="stone"){this.callbacks.onToast("Abra o inventário para fabricar");return;}
    if(item==="rawMeat"){this.callbacks.onToast("Asse a carne perto de uma fogueira");return;}
    if(item==="hammer"){if(this.hammer)this.callbacks.onBuildMenu();else this.callbacks.onToast("Fabrique um martelo no inventário");return;}
    if(item==="spear"){if(this.spearDurability>0)this.startAttack();else this.callbacks.onToast("Fabrique uma lança no inventário");return;}
    this.callbacks.onToast("Atalho vazio — organize-o no inventário");
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
    if(CARRIED_EQUIPMENT_IDS.includes(recipeId))this.weaponSlots=rememberWeapon(this.weaponSlots,recipeId,this.currentEquipment());
    this.callbacks.onToast(`${recipe.name} fabricado`);this.pulse(.35,90);this.saveGame();this.emitSnapshot();return true;
  }

  private placeCampfire(){
    if(this.underground){this.callbacks.onToast("Não há ventilação segura para uma fogueira aqui");return;}
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
      this.health=save.health;this.hunger=save.hunger;this.berries=save.berries;this.rawMeat=save.rawMeat;this.cookedMeat=save.cookedMeat;this.wood=save.wood;this.stone=save.stone;
      this.axeDurability=save.axeDurability;this.pickaxeDurability=save.pickaxeDurability;this.spearDurability=save.spearDurability;this.hammer=save.hammer;
      this.campfireKits=save.campfireKits;this.survivalTime=save.survivalTime;this.survivedNights=save.survivedNights;this.selectedSlot=save.selectedSlot;this.hotbarSlots=normalizeHotbarSlots(save.hotbarSlots);this.equipmentSlots=normalizeEquipmentSlots(save.equipmentSlots);this.weaponSlots=normalizeWeaponSlots(save.weaponSlots);
      const restoredEquipment=this.currentEquipment();if(restoredEquipment!=="hands")this.weaponSlots=rememberWeapon(this.weaponSlots,restoredEquipment);
      this.collectedResources=new Set(save.collectedResources);this.defeatedFauna=new Set(save.defeatedFauna);this.visitedPois=new Set(save.visitedPois);this.resourceDamage=new Map(Object.entries(save.resourceDamage));this.pendingCampfires=save.campfires;this.pendingStructures=save.structures;
      this.spawnPosition.set(save.position.x,save.position.y,save.position.z);
      this.respawnPosition=save.respawn?new THREE.Vector3(save.respawn.x,save.respawn.y,save.respawn.z):null;
      return true;
    }catch{return false;}
  }

  private restoreWorldObjects(){
    for(const fire of this.pendingCampfires)this.addCampfire(fire.x,fire.y,fire.z);
    for(const saved of this.pendingStructures){const definition=getBuildingPiece(saved.id);if(definition)this.addStructure(definition,new THREE.Vector3(saved.x,saved.y,saved.z),saved.rotation,saved.storage,{health:saved.health,open:saved.open});}
    this.pendingCampfires=[];this.pendingStructures=[];
  }

  private saveGame(){
    if(typeof window==="undefined"||!this.playerBody||this.health<=0)return;
    const bodyPosition=this.playerBody.translation(),position=this.underground&&this.caveReturnPosition?this.caveReturnPosition:bodyPosition;
    try{window.localStorage.setItem(SAVE_KEY,JSON.stringify({
      version:SAVE_VERSION,position:{x:position.x,y:position.y,z:position.z},health:this.health,hunger:this.hunger,
      berries:this.berries,rawMeat:this.rawMeat,cookedMeat:this.cookedMeat,wood:this.wood,stone:this.stone,axeDurability:this.axeDurability,pickaxeDurability:this.pickaxeDurability,spearDurability:this.spearDurability,
      hammer:this.hammer,campfireKits:this.campfireKits,survivalTime:this.survivalTime,survivedNights:this.survivedNights,selectedSlot:this.selectedSlot,hotbarSlots:this.hotbarSlots,equipmentSlots:this.equipmentSlots,weaponSlots:this.weaponSlots,
      collectedResources:[...this.collectedResources],defeatedFauna:[...this.defeatedFauna],visitedPois:[...this.visitedPois],resourceDamage:Object.fromEntries(this.resourceDamage),campfires:this.campfires.map(fire=>({x:fire.position.x,y:fire.position.y,z:fire.position.z})),
      structures:this.structures.map(structure=>({id:structure.id,x:structure.position.x,y:structure.position.y,z:structure.position.z,rotation:structure.rotation,storage:structure.storage,health:structure.health,open:structure.open})),
      respawn:this.respawnPosition?{x:this.respawnPosition.x,y:this.respawnPosition.y,z:this.respawnPosition.z}:null,
    }));}catch{/* localStorage may be unavailable */}
  }

  startBuilding(pieceId:string){
    if(this.underground){this.callbacks.onToast("Construção indisponível nas profundezas");return false;}
    if(!this.hammer){this.callbacks.onToast("Fabrique um martelo primeiro");return false;}
    const definition=getBuildingPiece(pieceId);if(!definition)return false;
    this.cancelBuilding(false);this.buildingDefinition=definition;this.buildingRotation=0;
    this.buildingGhost=this.createStructureModel(definition,true);this.scene.add(this.buildingGhost);this.updateBuildingPreview();
    this.callbacks.onToast(`${definition.name}: posicione e confirme`);this.emitSnapshot();return true;
  }

  private cancelBuilding(notify=true){
    if(this.buildingGhost){this.scene.remove(this.buildingGhost);this.disposeGroup(this.buildingGhost);}
    this.buildingGhost=null;this.buildingDefinition=null;this.buildingValid=false;this.buildingSnap="";this.buildingIssue="";this.buildingSnapKey="";this.pendingBuilding=null;if(notify)this.callbacks.onToast("Construção cancelada");this.emitSnapshot();
  }

  private rotateBuilding(){this.buildingRotation=(this.buildingRotation+Math.PI/2)%(Math.PI*2);this.updateBuildingPreview();this.pulse(.08,30);}

  private updateBuildingPreview(){
    if(!this.buildingDefinition||!this.buildingGhost||!this.playerBody)return;
    const player=this.playerBody.translation(),facing=this.playerVisual.rotation.y;
    const freeX=snapToGrid(player.x+Math.sin(facing)*3.1),freeZ=snapToGrid(player.z+Math.cos(facing)*3.1),freeY=terrainHeightAt(freeX,freeZ);
    const structures=this.structures.map(structure=>({id:structure.id,x:structure.position.x,y:structure.position.y,z:structure.position.z,rotation:structure.rotation}));
    const snap=findBuildingSnap(this.buildingDefinition.id,{x:freeX,y:freeY,z:freeZ,rotation:this.buildingRotation},structures);
    const x=snap?.x??freeX,y=snap?.y??freeY,z=snap?.z??freeZ,rotation=snap?.rotation??this.buildingRotation;
    this.buildingGhost.position.set(x,y,z);this.buildingGhost.rotation.y=rotation;
    this.buildingSnap=snap?.label??"";
    const snapKey=snap?`${snap.kind}:${x.toFixed(2)}:${y.toFixed(2)}:${z.toFixed(2)}`:"";
    if(snapKey&&snapKey!==this.buildingSnapKey)this.pulse(.055,24);
    this.buildingSnapKey=snapKey;
    const quarter=Math.round(rotation/(Math.PI/2))%2;const [baseWidth,,baseDepth]=this.buildingDefinition.size;
    const width=quarter?baseDepth:baseWidth,depth=quarter?baseWidth:baseDepth;
    const overlap=buildingPlacementBlocked({id:this.buildingDefinition.id,x,y,z,rotation},structures);
    const slope=Math.max(Math.abs(y-terrainHeightAt(x+width*.45,z)),Math.abs(y-terrainHeightAt(x,z+depth*.45)));
    const hasMaterials=canBuild(this.buildingDefinition,{wood:this.wood,stone:this.stone}),supported=isStructureSupported({id:this.buildingDefinition.id,x,y,z,rotation},structures);
    const missing=[];if(this.wood<this.buildingDefinition.cost.wood)missing.push(`madeira ${this.wood}/${this.buildingDefinition.cost.wood}`);if(this.stone<this.buildingDefinition.cost.stone)missing.push(`pedra ${this.stone}/${this.buildingDefinition.cost.stone}`);
    this.buildingIssue=!hasMaterials?`Materiais insuficientes · ${missing.join(" · ")}`:overlap?"Espaço ocupado":!supported?"Sem sustentação":!snap&&slope>=1.1?"Terreno inclinado":"";
    this.buildingValid=hasMaterials&&!overlap&&supported&&(Boolean(snap)||slope<1.1);
    this.tintGhost(this.buildingGhost,this.buildingValid?0x69e6a0:0xff6b62);
  }

  private placeBuilding(){
    if(!this.buildingDefinition||!this.buildingGhost)return;
    if(!this.buildingValid){this.callbacks.onToast(this.buildingIssue||"Não é possível construir aqui");this.pulse(.22,70);return;}
    if(this.attackTime>0||this.pendingBuilding)return;
    this.pendingBuilding={definition:this.buildingDefinition,position:this.buildingGhost.position.clone(),rotation:this.buildingGhost.rotation.y};
    this.startToolUse("hammer");
  }

  private resolveBuildingPlacement(){
    if(!this.pendingBuilding)return;
    const {definition,position,rotation}=this.pendingBuilding;this.pendingBuilding=null;
    this.wood-=definition.cost.wood;this.stone-=definition.cost.stone;this.addStructure(definition,position,rotation);
    if(definition.id==="bed"){this.respawnPosition=new THREE.Vector3(position.x,position.y+1.6,position.z);this.callbacks.onToast("Cama pronta — durma à noite com F ou ○");}
    else this.callbacks.onToast(`${definition.name} construída`);
    this.pulse(.45,110);this.cancelBuilding(false);this.saveGame();this.emitSnapshot();
  }

  private addStructure(definition:BuildingDefinition,position:THREE.Vector3,rotation:number,storage?:StructureStorage,state?:{health?:number;open?:boolean}){
    const group=this.createStructureModel(definition,false);group.position.copy(position);group.rotation.y=rotation;this.scene.add(group);
    const open=definition.id==="door"&&Boolean(state?.open);if(open)(group.userData.doorLeaf as THREE.Group|undefined)?.rotation.set(0,-Math.PI*.52,0);
    const collider=open?null:this.createStructureCollider(definition,position,rotation);
    this.structures.push({id:definition.id,group,position:position.clone(),rotation,definition,collider,storage:storage??{berries:0,wood:0,stone:0},health:Math.min(definition.health,state?.health??definition.health),maxHealth:definition.health,open});
  }

  private createStructureCollider(definition:BuildingDefinition,position:THREE.Vector3,rotation:number){const [width,height,depth]=definition.size;return this.world.createCollider(RAPIER.ColliderDesc.cuboid(width/2,height/2,depth/2).setTranslation(position.x,position.y+definition.yOffset,position.z).setRotation({x:0,y:Math.sin(rotation/2),z:0,w:Math.cos(rotation/2)}));}

  private createStructureModel(definition:BuildingDefinition,ghost:boolean){
    const group=new THREE.Group();const wood=new THREE.MeshToonMaterial({color:0x8a633d,gradientMap:this.toonGradient});const dark=new THREE.MeshToonMaterial({color:0x4e3829,gradientMap:this.toonGradient});const cloth=new THREE.MeshToonMaterial({color:0x759b83,gradientMap:this.toonGradient});
    const box=(size:[number,number,number],position:[number,number,number],material:THREE.Material=wood)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);};
    if(definition.id==="foundation")box([3,.28,3],[0,.14,0]);
    if(definition.id==="wall")for(const x of [-1.2,-.6,0,.6,1.2])box([.52,2.7,.22],[x,1.35,0]);
    if(definition.id==="door"){box([.48,2.7,.22],[-1.25,1.35,0]);box([.48,2.7,.22],[1.25,1.35,0]);box([2.05,.52,.22],[0,2.44,0]);const leaf=new THREE.Group();leaf.position.set(-.98,0,.02);group.add(leaf);const panel=(x:number,y:number)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(.42,.72,.14),wood);mesh.position.set(x,y,0);mesh.castShadow=true;leaf.add(mesh);};for(const x of[.22,.66,1.1,1.54,1.98])for(const y of[.42,1.18,1.94])panel(x,y);group.userData.doorLeaf=leaf;}
    if(definition.id==="roof")box([3.3,.25,3.3],[0,2.78,0]);
    if(definition.id==="slopedRoof"){box([3.3,.22,1.75],[0,2.42,-.72]);box([3.3,.22,1.75],[0,2.42,.72]);group.children[0].rotation.x=-.42;group.children[1].rotation.x=.42;}
    if(definition.id==="stairs")for(let step=0;step<6;step+=1)box([1.4,.25,.48],[0,.13+step*.25,-1.2+step*.48]);
    if(definition.id==="ramp"){box([3,.25,3],[0,.82,0]);group.children[0].rotation.x=-.46;}
    if(definition.id==="chest"){box([1.25,.62,.75],[0,.31,0],dark);box([1.3,.18,.8],[0,.72,0],wood);box([.12,.28,.08],[0,.46,.41],new THREE.MeshToonMaterial({color:0xd7aa52,gradientMap:this.toonGradient}));}
    if(definition.id==="bed"){box([1.2,.18,2.2],[0,.12,0],dark);box([1.05,.22,1.98],[0,.31,0],cloth);box([.95,.2,.48],[0,.48,-.68],new THREE.MeshToonMaterial({color:0xd9d1b7,gradientMap:this.toonGradient}));}
    if(ghost)group.traverse(object=>{if(object instanceof THREE.Mesh){object.material=(object.material as THREE.Material).clone();const material=object.material as THREE.MeshStandardMaterial;material.transparent=true;material.opacity=.48;object.castShadow=false;}});
    return group;
  }

  private toggleDoor(structure:Structure){structure.open=!structure.open;const leaf=structure.group.userData.doorLeaf as THREE.Group|undefined;if(leaf)leaf.rotation.y=structure.open?-Math.PI*.52:0;if(structure.open&&structure.collider){this.world.removeCollider(structure.collider,false);structure.collider=null;}else if(!structure.open&&!structure.collider)structure.collider=this.createStructureCollider(structure.definition,structure.position,structure.rotation);this.callbacks.onToast(structure.open?"Porta aberta":"Porta fechada");this.pulse(.1,35);this.saveGame();this.emitSnapshot();}

  private repairStructure(structure:Structure){if(!this.hammer)return;if(structure.health>=structure.maxHealth){this.callbacks.onToast("Estrutura já está íntegra");return;}const cost=structureRepairCost(structure.definition,structure.health);if(this.wood<cost.wood||this.stone<cost.stone){this.callbacks.onToast(`Reparo exige ${cost.wood} madeira e ${cost.stone} pedra`);return;}this.wood-=cost.wood;this.stone-=cost.stone;structure.health=structure.maxHealth;this.callbacks.onToast(`${structure.definition.name} reparada`);this.pulse(.35,90);this.saveGame();this.emitSnapshot();}

  private dismantleStructure(structure:Structure){if(!this.hammer){this.callbacks.onToast("Equipe o martelo para desmontar");return;}const collapsing=unsupportedStructuresAfterRemoval(structure,this.structures);const refund=structureRefund(structure.definition);this.wood+=refund.wood;this.stone+=refund.stone;this.removeStructure(structure);for(const dependent of collapsing)this.removeStructure(dependent);this.callbacks.onToast(`${structure.definition.name} desmontada · ${refund.wood} madeira, ${refund.stone} pedra${collapsing.length?` · ${collapsing.length} peça(s) sem suporte desabaram`:""}`);this.pulse(.42,110);this.saveGame();this.emitSnapshot();}

  private damageStructure(structure:Structure,damage:number,attacker:string){structure.health=Math.max(0,structure.health-damage);if(structure.health<=0){const collapsing=unsupportedStructuresAfterRemoval(structure,this.structures);this.removeStructure(structure);for(const dependent of collapsing)this.removeStructure(dependent);this.callbacks.onToast(`${attacker} destruiu ${structure.definition.name}${collapsing.length?` · ${collapsing.length} peça(s) desabaram`:""}`);}else this.callbacks.onToast(`${attacker} atacou ${structure.definition.name} · ${structure.health}/${structure.maxHealth}`);this.saveGame();}

  private removeStructure(structure:Structure){if(structure.collider)this.world.removeCollider(structure.collider,false);this.scene.remove(structure.group);this.disposeGroup(structure.group);this.structures=this.structures.filter(candidate=>candidate!==structure);if(this.nearestStructure===structure)this.nearestStructure=null;if(this.nearestChest===structure)this.nearestChest=null;if(this.nearestBed===structure)this.nearestBed=null;}

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
    const clock=worldTimeAt(this.survivalTime),{fraction,isNight}=clock;
    if(this.underground)return{fraction,isNight,nearFire:false,sheltered:true,temperature:11,timeLabel:clock.timeLabel};
    const position=this.playerBody?.translation()??{x:0,y:0,z:0};const nearFire=this.campfires.some(fire=>Math.hypot(position.x-fire.position.x,position.z-fire.position.z)<6);
    const sheltered=this.structures.some(structure=>structure.id==="roof"&&Math.abs(position.x-structure.position.x)<2.15&&Math.abs(position.z-structure.position.z)<2.15&&position.y<structure.position.y+3.2);
    const terrain=terrainHeightAt(position.x,position.z),biome=biomeAt(position.x,position.z);const biomeTemperature=biome.id==="highlands"?-4:biome.id==="riverlands"?-1:biome.id==="forest"?-2:0;const temperature=Math.round(nearFire?23:(isNight?(sheltered?9:3):18)+biomeTemperature-Math.max(0,terrain-2)*.45);
    return{fraction,isNight,nearFire,sheltered,temperature,timeLabel:clock.timeLabel};
  }

  private updateCamera(dt:number) {
    const target=this.player.position.clone().add(new THREE.Vector3(0,this.underground?.9:1.3,0));
    const distance=this.underground?7.2:10.2;
    const desired=this.underground
      ? target.clone().add(new THREE.Vector3(Math.sin(this.yaw)*distance,9.2,Math.cos(this.yaw)*distance))
      : target.clone().add(new THREE.Vector3(Math.sin(this.yaw)*Math.cos(this.pitch)*distance,Math.sin(this.pitch)*distance+1,Math.cos(this.yaw)*Math.cos(this.pitch)*distance));
    if(this.underground){desired.x=THREE.MathUtils.clamp(desired.x,-CAVE_HALF_SIZE+1.4,CAVE_HALF_SIZE-1.4);desired.z=THREE.MathUtils.clamp(desired.z,-CAVE_HALF_SIZE+1.4,CAVE_HALF_SIZE-1.4);}
    const alpha=1-Math.pow(.001,dt); this.camera.position.lerp(desired,alpha); this.camera.lookAt(target);
  }

  private updateAmbient() {
    if(this.underground){const anchor=this.player.position,dark=new THREE.Color(0x24343a);this.renderer.toneMappingExposure=1.32;this.sun.intensity=.42;this.hemi.intensity=1.15;this.hemi.color.setHex(0x8eb4b1);this.hemi.groundColor.setHex(0x38443f);this.sky.dome.visible=false;this.sky.range.visible=false;this.sky.sun.visible=false;(this.scene.background as THREE.Color).copy(dark);(this.scene.fog as THREE.Fog).color.copy(dark);this.scene.fog.near=17;this.scene.fog.far=48;this.sun.position.copy(anchor).add(new THREE.Vector3(-3,9,-4));this.terrainMaterial.color.setHex(0x64726c);this.grassMaterial.color.setHex(0x35473d);return;}
    this.renderer.toneMappingExposure=1.08;this.sky.dome.visible=true;this.sky.range.visible=true;this.sky.sun.visible=true;(this.scene.fog as THREE.Fog).near=26;(this.scene.fog as THREE.Fog).far=122;
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
    const worldState=this.getWorldState();
    const sleepPrompt=worldState.isNight&&(this.nearestBed||worldState.nearFire)?`${this.lastGamepadName?"○":"F"} · Dormir até o amanhecer`:"";
    const structurePrompt=this.nearestStructure?(this.nearestStructure.id==="door"?`${this.lastGamepadName?"□":"E"} abrir/fechar · `:"")+(this.hammer?`${this.lastGamepadName?"△":"Q"} reparar · ${this.lastGamepadName?"R3":"X"} desmontar · `:"")+`${this.nearestStructure.health}/${this.nearestStructure.maxHealth}`:"";
    const resourcePrompt=this.nearestResource?(this.nearestResource.kind==="berry"?`${this.lastGamepadName?"□":"E"} · Coletar frutos`:`${this.lastGamepadName?"△":"Q"} · Golpear ${this.nearestResource.kind==="wood"?"árvore":"rocha"} · ${this.nearestResource.health}/${this.nearestResource.maxHealth}`):"";
    const ambientPrompt=[this.rawMeat>0&&worldState.nearFire?`${this.lastGamepadName?"□":"E"} · Assar alimento cru`:"",this.nearWater?`${this.lastGamepadName?"□":"E"} · Pescar na margem`:"",sleepPrompt].filter(Boolean).join("   ·   ");
    const interaction=this.nearCaveExit?`${this.lastGamepadName?"□":"E"} · Voltar à superfície`:this.nearCaveCache?`${this.lastGamepadName?"□":"E"} · Saquear tesouro`:this.nearestPoi?`${this.lastGamepadName?"□":"E"} · ${this.nearestPoi.type==="cave"?"Entrar na caverna":`Explorar ${this.nearestPoi.type==="ruin"?"ruína":"acampamento abandonado"}`}`:this.nearestAnimal?`${this.lastGamepadName?"△":"Q"} · Atacar ${FAUNA_STATS[this.nearestAnimal.kind].name} · ${this.nearestAnimal.health}/${this.nearestAnimal.maxHealth}`:this.nearestChest?`${this.lastGamepadName?"□":"E"} · Guardar ou retirar recursos`:structurePrompt||resourcePrompt||ambientPrompt;
    const biome=biomeAt(position.x,position.z),event=worldState.isNight?nightEventFor(this.survivedNights+1).name:"",mapMarkers:Array<{x:number;z:number;kind:string;looted?:boolean}>=[];
    if(this.underground){mapMarkers.push({x:-position.x,z:CAVE_ENTRY_Z-position.z,kind:"exit"},{x:-position.x,z:CAVE_CACHE_Z-position.z,kind:"cache",looted:this.visitedPois.has(this.activeCavePoi)});for(const animal of this.caveAnimals)if(animal.deadTimer<=0)mapMarkers.push({x:animal.x-position.x,z:animal.z-position.z,kind:"goblin"});}
    else{for(const chunk of this.loadedChunks.values()){for(const poi of chunk.pois)mapMarkers.push({x:poi.x-position.x,z:poi.z-position.z,kind:poi.type,looted:poi.looted});for(const animal of chunk.animals)if(["predator","bear","golem"].includes(animal.kind)&&animal.deadTimer<=0)mapMarkers.push({x:animal.x-position.x,z:animal.z-position.z,kind:animal.kind});}for(const structure of this.structures)if(structure.id==="bed")mapMarkers.push({x:structure.position.x-position.x,z:structure.position.z-position.z,kind:"home"});}
    this.callbacks.onSnapshot({health:Math.round(this.health),hunger:Math.round(this.hunger),berries:this.berries,rawMeat:this.rawMeat,cookedMeat:this.cookedMeat,wood:this.wood,stone:this.stone,distance:Math.round(Math.hypot(position.x,position.z)),chunks:this.loadedChunks.size,biome:this.underground?"Cavernas profundas":biome.name,interaction,selectedSlot:this.selectedSlot,hotbarSlots:[...this.hotbarSlots],equipmentSlots:{...this.equipmentSlots},weaponSlots:[...this.weaponSlots],coldProtection:0,heatProtection:0,axeDurability:this.axeDurability,pickaxeDurability:this.pickaxeDurability,spearDurability:this.spearDurability,campfireKits:this.campfireKits,timeLabel:worldState.timeLabel,isNight:worldState.isNight,temperature:worldState.temperature,nearFire:worldState.nearFire,survivedNights:this.survivedNights,hammer:this.hammer,buildingPiece:this.buildingDefinition?.name??"",buildingValid:this.buildingValid,buildingSnap:this.buildingSnap,buildingIssue:this.buildingIssue,sheltered:worldState.sheltered,comboStep:this.comboStep,comboBuffered:this.comboBuffered,gamepad:this.lastGamepadName,nightEvent:event,playerX:position.x,playerZ:position.z,heading:this.playerVisual.rotation.y,climbStamina:Math.round(this.climbStamina),climbing:this.climbing,underground:this.underground,mapMarkers:mapMarkers.filter(marker=>Math.hypot(marker.x,marker.z)<75)});
  }

  reset() {
    if(!this.world)return;
    if(this.underground)this.exitCave();this.underground=false;this.activeCavePoi="";this.caveReturnPosition=null;this.climbing=false;this.climbStamina=100;
    this.health=EMPTY_SNAPSHOT.health; this.hunger=EMPTY_SNAPSHOT.hunger; this.berries=0;this.rawMeat=0;this.cookedMeat=0; this.wood=0; this.stone=0;this.axeDurability=0;this.pickaxeDurability=0;this.spearDurability=0;this.campfireKits=0;this.hammer=false;this.survivalTime=0;this.wasNight=false;this.survivedNights=0;this.respawnPosition=null;this.hotbarSlots=[...DEFAULT_HOTBAR];this.equipmentSlots={...DEFAULT_EQUIPMENT};this.weaponSlots=[...DEFAULT_WEAPON_SLOTS];
    this.verticalVelocity=0; this.horizontalVelocity.set(0,0,0); this.grounded=false;this.attackTime=0;this.attackEquipment="hands";this.comboStep=0;this.comboBuffered=0;this.comboResetTimer=0;this.attackTarget=null;this.pendingBuilding=null;this.collectedResources.clear();this.defeatedFauna.clear();this.visitedPois.clear();this.resourceDamage.clear();
    const y=terrainHeightAt(0,0)+2.2; this.playerBody.setTranslation({x:0,y,z:0},true); this.playerBody.setNextKinematicTranslation({x:0,y,z:0}); this.player.position.set(0,y-.93+PLAYER_MODEL_GROUND_OFFSET,0);
    this.grassTrail.set(0,y,0);
    this.emitSnapshot();
  }

  setPaused(value:boolean){this.paused=value;if(!value)this.clock.getDelta();}
  selectHotbarSlot(index:number,haptic=false){const next=(index+9)%9;if(next===this.selectedSlot)return;const previous=this.currentEquipment();this.selectedSlot=next;const equipped=this.currentEquipment();if(equipped!=="hands")this.weaponSlots=rememberWeapon(this.weaponSlots,equipped,previous);if(haptic)this.pulse(.1,28);this.emitSnapshot();}
  setHotbarSlot(index:number,itemId:string){const next=assignHotbarItem(this.hotbarSlots,index,itemId);if(next.every((item,slot)=>item===this.hotbarSlots[slot]))return;const previous=this.currentEquipment();this.hotbarSlots=next;this.selectedSlot=index;const equipped=this.currentEquipment();if(equipped!=="hands")this.weaponSlots=rememberWeapon(this.weaponSlots,equipped,previous);this.pulse(.12,38);this.saveGame();this.emitSnapshot();}
  equipWeapon(itemId:string){if(!CARRIED_EQUIPMENT_IDS.includes(itemId)||!this.ownsEquipment(itemId)){this.callbacks.onToast("Selecione uma ferramenta ou arma fabricada");return false;}this.weaponSlots=rememberWeapon(this.weaponSlots,itemId,this.currentEquipment());this.callbacks.onToast(`${itemId==="axe"?"Machado":itemId==="pickaxe"?"Picareta":itemId==="hammer"?"Martelo":"Lança"} equipado`);this.pulse(.14,45);this.saveGame();this.emitSnapshot();return true;}
  setWeaponSlot(index:number,itemId:string){if(!CARRIED_EQUIPMENT_IDS.includes(itemId)||!this.ownsEquipment(itemId))return false;this.weaponSlots=assignWeaponSlot(this.weaponSlots,index,itemId);this.pulse(.12,38);this.saveGame();this.emitSnapshot();return true;}
  applySettings(settings:GameSettings){const grassChanged=this.settings?.grassAmount!==settings.grassAmount;this.settings=settings;if(!this.renderer)return;const ratio=settings.quality==="high"?Math.min(devicePixelRatio,2):settings.quality==="medium"?Math.min(devicePixelRatio,1.5):1;this.renderer.setPixelRatio(ratio);this.renderer.shadowMap.enabled=settings.shadows;this.bloom.enabled=settings.bloom;if(grassChanged)this.rebuildGrass();this.resize();}
  private updateGamepad(){if(!this.settings?.gamepadEnabled)return;const pads=navigator.getGamepads?.()??[];let pad=this.gamepadIndex===null?null:pads[this.gamepadIndex];if(!pad?.connected)pad=Array.from(pads).find(Boolean)??null;this.gamepadIndex=pad?.index??null;const next=new Set<number>();pad?.buttons.forEach((button,index)=>{if(button.pressed||button.value>.55)next.add(index)});for(const index of next)if(!this.gamepadButtons.has(index))this.pressed.add(`pad-${index}`);this.gamepadButtons=next;const name=pad?(/dualsense|wireless controller/i.test(pad.id)?"DualSense conectado":`${pad.id.slice(0,22)} conectado`):"";if(name!==this.lastGamepadName){this.lastGamepadName=name;this.emitSnapshot();}}
  private getPad(){return this.gamepadIndex===null?null:navigator.getGamepads?.()[this.gamepadIndex]??null;}
  private consumePad(index:number){const key=`pad-${index}`;if(!this.pressed.has(key))return false;this.pressed.delete(key);return true;}
  private deadzone(x:number,y:number){const length=Math.hypot(x,y),dead=this.settings.deadzone;if(length<=dead)return{x:0,y:0};const scaled=Math.min(1,(length-dead)/(1-dead));return{x:x/length*scaled,y:y/length*scaled};}
  private pulse(strength:number,duration:number){if(!this.settings.gamepadEnabled||this.settings.vibration<=0)return;const pad=this.getPad() as (Gamepad&{vibrationActuator?:{playEffect?:(type:string,options:Record<string,number>)=>Promise<unknown>}})|null;const actuator=pad?.vibrationActuator;if(!actuator?.playEffect)return;const magnitude=Math.min(1,strength*this.settings.vibration);void actuator.playEffect("dual-rumble",{duration,startDelay:0,strongMagnitude:magnitude,weakMagnitude:magnitude*.65}).catch(()=>undefined);}
  testVibration(){this.pulse(1,220);}
  private resize(){if(!this.renderer)return;const width=this.canvas.clientWidth||innerWidth,height=this.canvas.clientHeight||innerHeight;this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.renderer.setSize(width,height,false);this.composer.setSize(width,height);}
  destroy(){if(this.initialized)this.saveGame();this.destroyed=true;cancelAnimationFrame(this.frame);this.listeners.forEach(listener=>listener());this.disposeCave();for(const chunk of this.loadedChunks.values()){this.world?.removeCollider(chunk.collider,false);chunk.grass?.dispose();chunk.flowers?.dispose();if(chunk.water){chunk.water.geometry.dispose();(chunk.water.material as THREE.Material).dispose();}for(const poi of chunk.pois)this.disposeGroup(poi.group);for(const animal of chunk.animals)this.disposeGroup(animal.group);}this.terrainMaterial.dispose();this.grassGeometry.dispose();this.flowerGeometry.dispose();this.grassMaterial.dispose();disposeFoliageAssets(this.foliage);this.sky.dome.geometry.dispose();(this.sky.dome.material as THREE.Material).dispose();this.sky.range.children.forEach(child=>(child as THREE.Mesh).geometry.dispose());this.sky.rangeMaterials.forEach(material=>material.dispose());this.sky.sun.geometry.dispose();this.sky.sunMaterial.dispose();this.renderer?.dispose();this.composer?.dispose();if(this.world&&this.character)this.world.removeCharacterController(this.character);}
}

export { WORLD_SEED };
