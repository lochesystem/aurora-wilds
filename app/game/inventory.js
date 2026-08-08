export const INVENTORY_ITEM_IDS=["hands","provisions","axe","pickaxe","campfire","wood","stone","hammer","spear","rawMeat"];
export const DEFAULT_HOTBAR=["hands","provisions","axe","pickaxe","campfire","wood","stone","hammer","spear"];
export const EQUIPMENT_SLOT_IDS=["head","body","legs","feet"];
export const DEFAULT_EQUIPMENT={head:"",body:"",legs:"",feet:""};
export const CARRIED_EQUIPMENT_IDS=["axe","pickaxe","hammer","spear"];
export const DEFAULT_WEAPON_SLOTS=["",""];

export function normalizeHotbarSlots(value){
  if(!Array.isArray(value))return[...DEFAULT_HOTBAR];
  const used=new Set(),slots=[];
  for(let index=0;index<9;index+=1){const item=typeof value[index]==="string"&&INVENTORY_ITEM_IDS.includes(value[index])&&!used.has(value[index])?value[index]:"";if(item)used.add(item);slots.push(item);}
  return slots;
}

export function assignHotbarItem(slots,index,itemId){
  const next=normalizeHotbarSlots(slots);if(index<0||index>=9||!INVENTORY_ITEM_IDS.includes(itemId))return next;
  const previousIndex=next.indexOf(itemId),displaced=next[index];
  if(previousIndex>=0)next[previousIndex]=displaced;
  next[index]=itemId;return next;
}

export function normalizeEquipmentSlots(value){
  const equipment={...DEFAULT_EQUIPMENT};if(!value||typeof value!=="object")return equipment;
  for(const slot of EQUIPMENT_SLOT_IDS)equipment[slot]=typeof value[slot]==="string"?value[slot]:"";
  return equipment;
}

export function normalizeWeaponSlots(value){
  if(!Array.isArray(value))return[...DEFAULT_WEAPON_SLOTS];
  const used=new Set();return DEFAULT_WEAPON_SLOTS.map((_,index)=>{const item=value[index];if(typeof item!=="string"||!CARRIED_EQUIPMENT_IDS.includes(item)||used.has(item))return"";used.add(item);return item;});
}

export function setWeaponSlot(slots,index,itemId){
  const next=normalizeWeaponSlots(slots);if(index<0||index>=2||!CARRIED_EQUIPMENT_IDS.includes(itemId))return next;
  const previous=next.indexOf(itemId);if(previous>=0)next[previous]=next[index];next[index]=itemId;return next;
}

export function rememberWeapon(slots,itemId,activeItem=""){
  const next=normalizeWeaponSlots(slots);if(!CARRIED_EQUIPMENT_IDS.includes(itemId)||next.includes(itemId))return next;
  const empty=next.indexOf("");if(empty>=0){next[empty]=itemId;return next;}
  const activeIndex=next.indexOf(activeItem);next[activeIndex===0?1:0]=itemId;return next;
}
