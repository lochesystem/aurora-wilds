import { normalizeEquipmentSlots, normalizeHotbarSlots, normalizeWeaponSlots } from "./inventory.js";

export const SAVE_KEY="aurora-wilds-save-v1";
export const SAVE_VERSION=1;

const finite=(value,fallback=0)=>typeof value==="number"&&Number.isFinite(value)?value:fallback;
const nonNegative=(value,fallback=0)=>Math.max(0,finite(value,fallback));

export function normalizeSave(raw){
  if(!raw||typeof raw!=="object"||raw.version!==SAVE_VERSION)return null;
  const position=raw.position;if(!position||typeof position!=="object")return null;
  return{
    version:SAVE_VERSION,
    position:{x:finite(position.x),y:finite(position.y,3),z:finite(position.z)},
    health:Math.min(100,nonNegative(raw.health,100)),hunger:Math.min(100,nonNegative(raw.hunger,78)),
    berries:Math.floor(nonNegative(raw.berries)),rawMeat:Math.floor(nonNegative(raw.rawMeat)),cookedMeat:Math.floor(nonNegative(raw.cookedMeat)),wood:Math.floor(nonNegative(raw.wood)),stone:Math.floor(nonNegative(raw.stone)),
    axeDurability:Math.min(100,nonNegative(raw.axeDurability)),pickaxeDurability:Math.min(100,nonNegative(raw.pickaxeDurability)),spearDurability:Math.min(100,nonNegative(raw.spearDurability)),hammer:Boolean(raw.hammer),campfireKits:Math.floor(nonNegative(raw.campfireKits)),
    survivalTime:nonNegative(raw.survivalTime),survivedNights:Math.floor(nonNegative(raw.survivedNights)),selectedSlot:Math.max(0,Math.min(8,Math.floor(nonNegative(raw.selectedSlot)))),hotbarSlots:normalizeHotbarSlots(raw.hotbarSlots),equipmentSlots:normalizeEquipmentSlots(raw.equipmentSlots),weaponSlots:normalizeWeaponSlots(raw.weaponSlots),
    collectedResources:Array.isArray(raw.collectedResources)?raw.collectedResources.filter(value=>typeof value==="string").slice(0,5000):[],
    defeatedFauna:Array.isArray(raw.defeatedFauna)?raw.defeatedFauna.filter(value=>typeof value==="string").slice(0,5000):[],
    visitedPois:Array.isArray(raw.visitedPois)?raw.visitedPois.filter(value=>typeof value==="string").slice(0,5000):[],
    resourceDamage:normalizeDamage(raw.resourceDamage),
    campfires:Array.isArray(raw.campfires)?raw.campfires.filter(validPlacement).slice(0,200):[],
    structures:Array.isArray(raw.structures)?raw.structures.filter(validStructure).slice(0,1000).map(value=>({...value,storage:normalizeStorage(value.storage),health:nonNegative(value.health,9999),open:Boolean(value.open)})):[],
    respawn:raw.respawn&&typeof raw.respawn==="object"?{x:finite(raw.respawn.x),y:finite(raw.respawn.y,3),z:finite(raw.respawn.z)}:null,
  };
}

function validPlacement(value){return value&&typeof value==="object"&&[value.x,value.y,value.z].every(Number.isFinite);}
function validStructure(value){return validPlacement(value)&&typeof value.id==="string"&&typeof value.rotation==="number"&&Number.isFinite(value.rotation);}
function normalizeStorage(value){return{berries:Math.floor(nonNegative(value?.berries)),wood:Math.floor(nonNegative(value?.wood)),stone:Math.floor(nonNegative(value?.stone))};}
function normalizeDamage(value){if(!value||typeof value!=="object")return{};return Object.fromEntries(Object.entries(value).filter(([id,damage])=>typeof id==="string"&&typeof damage==="number"&&Number.isFinite(damage)).slice(0,5000).map(([id,damage])=>[id,Math.max(0,Math.min(20,damage))]));}
