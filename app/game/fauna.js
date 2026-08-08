const FAUNA_SEED=1_947_113;

export const FAUNA_STATS={
  grazer:{name:"Cervo-das-luzes",health:32,notice:6.5,speed:3.9,meat:2,damage:0},
  predator:{name:"Lobo cinzento",health:46,notice:12,speed:3.25,meat:3,damage:11},
};

function hash2D(x,z,seed=FAUNA_SEED){
  let value=Math.imul(x,374_761_393)+Math.imul(z,668_265_263)+Math.imul(seed,69_069);
  value=Math.imul(value^(value>>>13),1_274_126_177);
  return((value^(value>>>16))>>>0)/4_294_967_295;
}

export function faunaForChunk(chunkX,chunkZ,chunkSize=32){
  const fauna=[];
  const grazerCount=1+(hash2D(chunkX,chunkZ,FAUNA_SEED+11)>.58?1:0);
  for(let index=0;index<grazerCount;index+=1){
    const x=chunkX*chunkSize+5+hash2D(chunkX*19+index,chunkZ*31-index,FAUNA_SEED+101)*(chunkSize-10);
    const z=chunkZ*chunkSize+5+hash2D(chunkX*37-index,chunkZ*13+index,FAUNA_SEED+203)*(chunkSize-10);
    fauna.push({id:`fauna:${chunkX}:${chunkZ}:g${index}`,kind:"grazer",x,z,heading:hash2D(index+chunkX,chunkZ-index,FAUNA_SEED+307)*Math.PI*2});
  }
  const originSafe=Math.abs(chunkX)<=1&&Math.abs(chunkZ)<=1;
  if(!originSafe&&hash2D(chunkX,chunkZ,FAUNA_SEED+409)>.68){
    const x=chunkX*chunkSize+6+hash2D(chunkX*43,chunkZ*17,FAUNA_SEED+503)*(chunkSize-12);
    const z=chunkZ*chunkSize+6+hash2D(chunkX*23,chunkZ*47,FAUNA_SEED+607)*(chunkSize-12);
    fauna.push({id:`fauna:${chunkX}:${chunkZ}:p0`,kind:"predator",x,z,heading:hash2D(chunkX,chunkZ,FAUNA_SEED+701)*Math.PI*2});
  }
  return fauna;
}

export function faunaHitDamage(equipment,comboStep=1){
  const base=equipment==="spear"?18:equipment==="axe"?11:equipment==="pickaxe"?9:7;
  return Math.round(base*(1+(Math.max(1,Math.min(3,comboStep))-1)*.16));
}

export function faunaIntent(kind,distance,provoked=false){
  const stats=FAUNA_STATS[kind];
  if(kind==="grazer")return provoked||distance<stats.notice?"flee":"wander";
  if(distance<1.35)return"attack";
  return provoked||distance<stats.notice?"chase":"wander";
}
