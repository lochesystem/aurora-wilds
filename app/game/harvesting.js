export const RESOURCE_HEALTH = { wood:6, stone:8 };

export function harvestHit(kind,health,equipped){
  const strongTool=kind==="wood"&&equipped==="axe"||kind==="stone"&&equipped==="pickaxe";
  const damage=strongTool?(kind==="wood"?3:4):1;
  const applied=Math.min(Math.max(0,health),damage);
  return{
    damage:applied,
    drop:applied,
    remaining:Math.max(0,health-applied),
    destroyed:health-applied<=0,
    durabilityCost:strongTool?5:0,
    strongTool,
  };
}
