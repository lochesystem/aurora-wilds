export const INVENTORY_ITEM_IDS=["hands","provisions","axe","pickaxe","campfire","wood","stone","hammer","spear","rawMeat"];
export const DEFAULT_HOTBAR=["hands","provisions","axe","pickaxe","campfire","wood","stone","hammer","spear"];

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
