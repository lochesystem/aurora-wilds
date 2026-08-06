const LEVEL_NAMES = [
  "Primeira Luz", "Jardins Suspensos", "Curva Celeste", "Passos de Bruma", "Ninho do Vento",
  "Tubos do Poente", "Arcos de Jade", "Salto das Nuvens", "Vigia Carmesim", "Coroa Solar",
  "Vale Invertido", "Trilha do Trovão", "Torres Gêmeas", "Rota Safira", "Cerco do Céu",
  "Espiral Dourada", "Jardim dos Ecos", "Escada Estelar", "Olho da Tempestade", "Bastião Rubro",
  "Último Horizonte", "Marcha da Aurora", "Picos Radiantes", "Portões do Amanhã", "Cume Infinito",
];

const GIMMICKS = [
  "Subida guiada", "Jardins em zigue-zague", "Curvas sobre o vazio", "Primeiras ilhas estreitas", "Arena dos guardiões",
  "Escadaria de canos", "Travessia em arcos", "Plataformas de impulso", "Corredor de atiradores", "Torre em espiral",
  "Descer para voltar a subir", "Impulsos sobre o abismo", "Duas torres intercaladas", "Pontes estreitas", "Cerco em três frentes",
  "Canos em espiral", "Rota ampla de exploração", "Escada de precisão", "Fogo cruzado e impulsos", "Fortaleza vertical",
  "Ilhas mínimas", "Escalada por canos", "Picos e espinhos", "Prova de todas as técnicas", "Ascensão final",
];

const PALETTES = [
  [0x57a875,0x62bc82,0x4e9f78], [0x5aa9a0,0x69c0aa,0x4c958f], [0x6c83b5,0x7597c8,0x526ca0],
  [0xa56c83,0xbc7d91,0x8c5975], [0xb8914f,0xd0aa62,0x9e783e],
];

const COURSE_VOCABULARIES = [
  ["block","beam","island","slab"], ["pipeDeck","block","beam","column"], ["slab","small","block","beam"],
  ["column","beam","ruin","block"], ["arena","block","slab","beam"], ["pipeDeck","column","block","beam"],
  ["beam","scaffold","block","slab"], ["small","jumpDeck","beam","block"], ["bunker","beam","slab","column"],
  ["column","small","beam","ruin"], ["ruin","block","slab","small"], ["jumpDeck","beam","column","block"],
];

function topology(number){
  const family=(number-1)%12;
  const layouts=[
    [[4,1.6,-7,7,6],[-2,3.1,-12,6,6],[-7,4.5,-17,5,5],[-1,5.7,-21,6,5],[5,7,-25,5,5],[0,8.4,-30,7,7]],
    [[0,1.5,-8,9,8],[-6,3,-12,6,6],[6,3.2,-12,6,6],[-8,4.2,-18,5,5],[8,4.5,-18,5,5],[0,5.6,-20,8,7],[0,7.2,-27,7,7]],
    [[0,1.3,-5,6,6],[5,2.1,-7,5,5],[7,2.9,-12,5,5],[5,3.5,-17,5,5],[0,4,-19,5,5],[-5,3.4,-17,5,5],[-7,2.8,-12,5,5],[-5,2.1,-7,5,5],[0,5.6,-12,7,7]],
    [[0,1.5,-8,9,8],[-7,2.8,-8,5,5],[7,3.1,-8,5,5],[0,3.2,-15,6,6],[-7,4.3,-15,5,5],[7,4.6,-15,5,5],[0,5.8,-21,8,7]],
    [[0,1.7,-10,14,11],[-8,3.1,-10,5,5],[8,3.4,-10,5,5],[-5,4.6,-17,5,5],[5,4.9,-17,5,5],[0,6.1,-22,8,7]],
    [[-5,1.2,-7,6,6],[4,1.4,-8,6,6],[-5,2.7,-14,6,6],[4,3,-15,6,6],[0,4.2,-21,8,7],[-6,5.5,-25,5,5],[0,6.8,-29,7,7]],
    [[0,1.2,-9,2.8,8,"beam"],[0,2.5,-15,6,5],[-5,3.5,-19,8,2.6,"beam"],[-9,4.6,-19,5,5],[-9,5.8,-26,2.7,8,"beam"],[-4,7,-31,6,6],[2,8.2,-34,7,7]],
    [[-5,-.7,-7,6,6],[3,-1.5,-11,6,6],[8,-.4,-16,5,5],[3,1.2,-21,6,6],[-3,2.8,-24,5,5],[-8,4.3,-20,5,5],[-4,5.8,-14,6,6],[1,7.2,-10,7,7]],
    [[-4,1.4,-8,5,8],[4,1.6,-8,5,8],[-4,3,-15,5,6],[4,3.2,-15,5,6],[-4,4.7,-21,5,6],[4,5,-21,5,6],[0,6.4,-27,8,7]],
    [[-4,1.4,-6,5,5],[-7,2.8,-11,5,5],[-6,4.1,-17,5,5],[-2,5.4,-21,5,5],[4,6.6,-20,5,5],[7,7.8,-15,5,5],[6,9,-9,5,5],[1,10.2,-6,7,7]],
    [[-5,1.2,-8,5,5],[3,1.8,-10,5,5],[8,2.5,-6,5,5],[9,3.2,-14,5,5],[2,4,-18,5,5],[-5,4.8,-16,5,5],[-9,5.5,-21,5,5],[-3,6.8,-25,7,7]],
    [[-5,1.5,-8,6,6],[5,1.8,-8,6,6],[-5,3.3,-15,6,6],[5,3.6,-15,6,6],[-5,5.1,-22,6,6],[5,5.4,-22,6,6],[0,6.8,-28,8,7]],
  ];
  if(number===25)return [[0,1.2,-7,8,7],[-7,2.5,-11,5,5],[7,2.8,-11,5,5],[-10,4,-18,5,5],[0,3.8,-15,6,6],[10,4.3,-18,5,5],[-7,5.5,-25,5,5],[7,5.8,-25,5,5],[0,7,-30,3,9,"beam"],[0,8.4,-37,8,8],[-6,9.8,-41,5,5],[6,10.1,-41,5,5],[0,11.6,-47,9,9]];
  return layouts[family];
}

export function generateLevel(levelNumber){
  const number=Math.max(1,Math.min(25,Math.round(levelNumber)));const difficulty=(number-1)/24;const region=Math.floor((number-1)/5)+1;
  const palette=PALETTES[region-1];const raw=topology(number);const cycle=Math.floor((number-1)/12);const vocabulary=COURSE_VOCABULARIES[(number-1)%12];
  const startWidth=14-(number%3)*.7,startDepth=12.5-(number%4)*.55;
  const platforms=[{p:[0,0,0],s:[startWidth,2,startDepth],c:palette[0],kind:number%4===0?"ruin":"island",r:[0,0,0]}];
  const verticalScale=3.75+number*.025;let previous={p:[0,0,0],s:[startWidth,2,startDepth]};
  raw.forEach((item,index)=>{
    const [baseX,baseY,baseZ,w,d,requestedKind]=item;const mirror=cycle%2?-1:1;
    const courseScale=1.68+difficulty*.34;
    const target={p:[baseX*mirror*courseScale+(cycle?Math.sin(index*1.7)*.9:0),baseY*verticalScale+cycle*index*.08,baseZ*courseScale-(cycle?Math.cos(index*1.3)*.8:0)],s:[w,1.15+(index%2)*.2,d]};
    const horizontalSpan=Math.hypot(target.p[0]-previous.p[0],target.p[2]-previous.p[2]);const verticalSpan=Math.abs(target.p[1]-previous.p[1]);const segments=Math.max(2,Math.ceil(horizontalSpan/(7.05+difficulty*1.1)),Math.ceil(verticalSpan/2.85));
    for(let step=1;step<segments;step++){
      const t=step/segments;const kind=vocabulary[(index*2+step)%vocabulary.length];const p=previous.p.map((value,axis)=>value+(target.p[axis]-value)*t);const dx=target.p[0]-previous.p[0],dz=target.p[2]-previous.p[2],span=Math.max(.001,Math.hypot(dx,dz));const lateral=(step%2?1:-1)*Math.sin(Math.PI*t)*(1.45+(number%4)*.18);p[0]+=(-dz/span)*lateral;p[2]+=(dx/span)*lateral;
      const dimensions=kindDimensions(kind,difficulty,index+step);platforms.push({p,s:dimensions,c:palette[(index+step)%3],kind,r:platformTilt(kind,index+step,number)});
    }
    const anchorKind=requestedKind||vocabulary[(index+3)%vocabulary.length];const precision=w<=5&&d<=5;
    platforms.push({p:target.p,s:safeSize([w-difficulty*(precision?.82:.28),target.s[1],d-difficulty*(precision?.82:.28)]),c:palette[(index+1)%3],kind:anchorKind==="island"&&precision?"small":anchorKind,r:index===raw.length-1?[0,0,0]:platformTilt(anchorKind,index*3+1,number)});previous=target;
  });
  separateCrampedOverlaps(platforms);
  const coins=buildCoinPlacements(platforms,number);
  const desiredEnemyCount=Math.min(10,3+Math.floor((number-1)/3));const enemies=[];
  const flatPlatforms=platforms.map((platform,index)=>({platform,index})).filter(({platform,index})=>index>0&&index<platforms.length-1&&!isTilted(platform));
  const enemySpawns=platforms.map((platform,index)=>({platform,index,patrol:Math.min(1.05,Math.max(.55,Math.min(platform.s[0],platform.s[2])/2-1.25))})).filter(({platform,index})=>index>0&&!isTilted(platform)&&Math.min(platform.s[0],platform.s[2])>=3.55).map(({platform,index,patrol})=>({platform,patrol,spawn:findEnemySpawn(platform,index,platforms,patrol,index+number)})).filter(candidate=>candidate.spawn);
  const enemyCount=Math.min(desiredEnemyCount,enemySpawns.length);
  for(let i=0;i<enemyCount;i++){const {spawn,patrol}=enemySpawns[(i+number)%enemySpawns.length];enemies.push({p:spawn,patrol,shooter:number>=5&&((i+number)%2===0||[9,15,19,20,24,25].includes(number))})}

  const pipeFocus=[2,6,10,16,22,24,25].includes(number);const pipeCount=pipeFocus?Math.min(6,2+Math.floor(number/6)):number>7?1:0;const pipes=[];
  for(let i=0;i<pipeCount;i++){const platform=flatPlatforms[(i*2+1)%flatPlatforms.length]?.platform??platforms[1];const [x,y,z]=platform.p,[w,h,d]=platform.s;pipes.push({p:[x+(i%2?1:-1)*Math.min(1,w*.18),y+h/2+.4,z+(i%2?-1:1)*Math.min(.7,d*.15)],height:1.05+difficulty*.9+(i%2)*.35,radius:.58})}

  const hazardFocus=[4,9,12,15,18,19,20,21,23,24,25].includes(number);const hazards=[];
  if(hazardFocus){const count=Math.min(5,1+Math.floor(number/7));for(let i=0;i<count;i++){const platform=flatPlatforms[(i*3+2)%flatPlatforms.length]?.platform??platforms[1];const [x,y,z]=platform.p,[w,h]=platform.s;hazards.push({p:[x+(i%2?1:-1)*Math.min(.8,w*.16),y+h/2+.42,z],radius:.62})}}
  const jumpFocus=[3,8,12,16,19,22,24,25].includes(number);const jumpPads=[];
  if(jumpFocus){const count=number>18?2:1;for(let i=0;i<count;i++){const platform=flatPlatforms[(i*4+1)%flatPlatforms.length]?.platform??platforms[1];const [x,y,z]=platform.p,[,h]=platform.s;jumpPads.push({p:[x,y+h/2+.44,z],power:12.8+difficulty*2.2})}}

  const last=platforms.at(-1);const [gx,gy,gz]=last.p,[,gh]=last.s;
  return {number,name:LEVEL_NAMES[number-1],gimmick:GIMMICKS[number-1],region,difficulty:region,challenge:difficulty,platforms,coins,enemies,pipes,hazards,jumpPads,spawn:[0,2.5,0],goal:[gx,gy+gh/2+.42,gz]};
}

function safeSize(size){return size.map(value=>Math.max(1,value))}

function kindDimensions(kind,difficulty,index){
  if(kind==="beam")return [1.78-difficulty*.36,.58,6.6+(index%2)*1.25];
  if(kind==="slab"||kind==="pipeDeck"||kind==="jumpDeck")return [5.75-difficulty*.65,.52,2.35-difficulty*.42+(index%2)*.55];
  if(kind==="column")return [3.05-difficulty*.5,2.45,3.05-difficulty*.5];
  if(kind==="scaffold")return [4.95-difficulty*.48,.44,2.5-difficulty*.42];
  if(kind==="bunker")return [5.2,1.8,4.2];
  if(kind==="arena")return [8.2,1.1,7.2];
  if(kind==="ruin")return [4.6,1.5,4.6];
  if(kind==="small")return [3.05-difficulty*.55,.72,3.05-difficulty*.55];
  return [3.8-difficulty*.72,.82,3.8-difficulty*.72];
}

function platformTilt(kind,index,number){
  const difficulty=(number-1)/24,frequency=number<7?7:number<16?6:5;
  if(["island","arena","column","bunker","pipeDeck","jumpDeck"].includes(kind)||(index+number)%frequency!==0)return [0,0,0];
  const amount=.055+difficulty*.1+((index+number)%3)*.018;return (index+number)%2?[amount,0,0]:[0,0,-amount];
}

function isTilted(platform){return platform.r?.some(value=>Math.abs(value)>.001)??false}

function platformBounds(platform){const [,y]=platform.p,[,h]=platform.s;return {bottom:y+.395-h/2,top:y+.395+h/2}}

function footprintsOverlap(a,b,margin=0){return Math.abs(a.p[0]-b.p[0])<(a.s[0]+b.s[0])/2+margin&&Math.abs(a.p[2]-b.p[2])<(a.s[2]+b.s[2])/2+margin}

function separateCrampedOverlaps(platforms){
  for(let pass=0;pass<3;pass++)for(let aIndex=0;aIndex<platforms.length;aIndex++)for(let bIndex=aIndex+1;bIndex<platforms.length;bIndex++){
    const a=platforms[aIndex],b=platforms[bIndex];if(!footprintsOverlap(a,b,.25))continue;const aBounds=platformBounds(a),bBounds=platformBounds(b);const lower=aBounds.top<=bBounds.top?a:b,upper=lower===a?b:a,gap=platformBounds(upper).bottom-platformBounds(lower).top;if(gap<=.02||gap>=2.15)continue;
    const movable=upper===platforms[0]?lower:upper,other=movable===a?b:a,dx=movable.p[0]-other.p[0],dz=movable.p[2]-other.p[2],neededX=(movable.s[0]+other.s[0])/2+.85-Math.abs(dx),neededZ=(movable.s[2]+other.s[2])/2+.85-Math.abs(dz);
    if(neededX<neededZ)movable.p[0]+=(dx>=0?1:-1)*neededX;else movable.p[2]+=(dz>=0?1:-1)*neededZ;
  }
  for(let pass=0;pass<3;pass++)for(let aIndex=0;aIndex<platforms.length;aIndex++)for(let bIndex=aIndex+1;bIndex<platforms.length;bIndex++){
    const a=platforms[aIndex],b=platforms[bIndex];if(!footprintsOverlap(a,b,.2))continue;const aBounds=platformBounds(a),bBounds=platformBounds(b),lower=aBounds.top<=bBounds.top?a:b,upper=lower===a?b:a,gap=platformBounds(upper).bottom-platformBounds(lower).top;if(gap>.02&&gap<2.15)upper.p[1]+=2.2-gap;
  }
}

function pointHasHeadroom(x,z,supportTop,platformIndex,platforms,clearance){return !platforms.some((other,index)=>{if(index===platformIndex)return false;const bottom=platformBounds(other).bottom;return bottom>supportTop&&bottom-supportTop<clearance&&Math.abs(x-other.p[0])<other.s[0]/2+.72&&Math.abs(z-other.p[2])<other.s[2]/2+.72})}

function enemyPathHasHeadroom(x,z,patrol,supportTop,platformIndex,platforms){return [[x,z],[x+patrol,z],[x-patrol,z],[x,z+patrol],[x,z-patrol]].every(([sampleX,sampleZ])=>pointHasHeadroom(sampleX,sampleZ,supportTop,platformIndex,platforms,2.35))}

function findEnemySpawn(platform,platformIndex,platforms,patrol,seed){
  const [x,y,z]=platform.p,[w,h,d]=platform.s,top=y+.395+h/2;const maxX=Math.max(0,w/2-patrol-.52),maxZ=Math.max(0,d/2-patrol-.52);const offsets=[[0,0],[maxX*.9,0],[-maxX*.9,0],[0,maxZ*.9],[0,-maxZ*.9],[maxX*.55,maxZ*.55],[-maxX*.55,maxZ*.55],[maxX*.55,-maxZ*.55],[-maxX*.55,-maxZ*.55]];
  for(let step=0;step<offsets.length;step++){const [ox,oz]=offsets[(step+seed)%offsets.length],candidate=[x+ox,top+.085,z+oz];if(enemyPathHasHeadroom(candidate[0],candidate[2],patrol,top,platformIndex,platforms))return candidate}
  return null;
}

function buildCoinPlacements(platforms,number){
  const coins=[];const flatIndices=platforms.map((platform,index)=>({platform,index})).filter(({platform})=>!isTilted(platform)).map(({index})=>index);const priority=flatIndices.filter(index=>index%2===0||index===platforms.length-1);
  const order=[...priority,...flatIndices.filter(index=>!priority.includes(index))];
  for(const platformIndex of order){
    if(coins.length>=Math.ceil(platforms.length/2))break;
    const candidate=findClearCoinPoint(platforms,platformIndex,number);if(!candidate)continue;
    if(coins.some(coin=>Math.hypot(coin[0]-candidate[0],coin[2]-candidate[2])<1&&Math.abs(coin[1]-candidate[1])<1.4))continue;
    coins.push(candidate);
  }
  return coins;
}

function findClearCoinPoint(platforms,platformIndex,number){
  const platform=platforms[platformIndex];const [x,y,z]=platform.p,[w,h,d]=platform.s;const top=y+.395+h/2;const maxX=Math.max(0,w/2-.62),maxZ=Math.max(0,d/2-.62);
  const offsets=[[0,0],[maxX*.72,0],[-maxX*.72,0],[0,maxZ*.72],[0,-maxZ*.72],[maxX*.62,maxZ*.62],[-maxX*.62,maxZ*.62],[maxX*.62,-maxZ*.62],[-maxX*.62,-maxZ*.62]];
  const shift=(number+platformIndex)%offsets.length;
  for(let offsetIndex=0;offsetIndex<offsets.length;offsetIndex++){
    const [ox,oz]=offsets[(offsetIndex+shift)%offsets.length];const candidate=[x+ox,top+1.02,z+oz];
    const blocked=platforms.some((other,otherIndex)=>{if(otherIndex===platformIndex)return false;const [otherX,otherY,otherZ]=other.p,[otherW,otherH,otherD]=other.s;if(Math.abs(candidate[0]-otherX)>otherW/2+.34||Math.abs(candidate[2]-otherZ)>otherD/2+.34)return false;const bottom=otherY+.395-otherH/2,otherTop=otherY+.395+otherH/2;const intersects=candidate[1]+.38>=bottom&&candidate[1]-.38<=otherTop;const cramped=bottom>top&&bottom-top<2.05;return intersects||cramped});
    if(!blocked)return candidate;
  }
  return null;
}

export function validateCoinPlacements(level){
  const issues=[];level.coins.forEach((coin,coinIndex)=>{const containing=level.platforms.filter(platform=>{const [x,y,z]=platform.p,[w,h,d]=platform.s;const bottom=y+.395-h/2,top=y+.395+h/2;return Math.abs(coin[0]-x)<=w/2+.34&&Math.abs(coin[2]-z)<=d/2+.34&&coin[1]+.38>=bottom&&coin[1]-.38<=top});if(containing.length)issues.push(`moeda ${coinIndex} dentro de bloco`);const support=level.platforms.find(platform=>{const [x,y,z]=platform.p,[w,h,d]=platform.s;const top=y+.395+h/2;return Math.abs(coin[0]-x)<=w/2-.2&&Math.abs(coin[2]-z)<=d/2-.2&&Math.abs(coin[1]-(top+1.02))<.04});if(!support){issues.push(`moeda ${coinIndex} sem apoio`);return}const supportTop=support.p[1]+.395+support.s[1]/2;const cramped=level.platforms.some(platform=>{if(platform===support)return false;const [x,y,z]=platform.p,[w,h,d]=platform.s;const bottom=y+.395-h/2;return Math.abs(coin[0]-x)<=w/2+.34&&Math.abs(coin[2]-z)<=d/2+.34&&bottom>supportTop&&bottom-supportTop<2.05});if(cramped)issues.push(`moeda ${coinIndex} sem altura livre`)});return issues;
}

export function validatePlatformClearance(level){
  const issues=[];for(let aIndex=0;aIndex<level.platforms.length;aIndex++)for(let bIndex=aIndex+1;bIndex<level.platforms.length;bIndex++){const a=level.platforms[aIndex],b=level.platforms[bIndex];if(!footprintsOverlap(a,b,.2))continue;const aBounds=platformBounds(a),bBounds=platformBounds(b),lower=aBounds.top<=bBounds.top?a:b,upper=lower===a?b:a,gap=platformBounds(upper).bottom-platformBounds(lower).top;if(gap>.02&&gap<2.15)issues.push(`blocos ${aIndex}/${bIndex} sem passagem para o personagem`)}return issues;
}

export function validateEnemyPlacements(level){
  const issues=[];level.enemies.forEach((enemy,enemyIndex)=>{const supportIndex=level.platforms.findIndex(platform=>{if(isTilted(platform))return false;const top=platformBounds(platform).top;return Math.abs(enemy.p[1]-(top+.085))<.05&&Math.abs(enemy.p[0]-platform.p[0])<=platform.s[0]/2-enemy.patrol-.45&&Math.abs(enemy.p[2]-platform.p[2])<=platform.s[2]/2-enemy.patrol-.45});if(supportIndex<0){issues.push(`inimigo ${enemyIndex} sem área de patrulha segura`);return}if(supportIndex===0)issues.push(`inimigo ${enemyIndex} na plataforma inicial`);const support=level.platforms[supportIndex],top=platformBounds(support).top,dx=Math.abs(enemy.p[0]-support.p[0]),dz=Math.abs(enemy.p[2]-support.p[2]);if(enemy.patrol+.45>support.s[0]/2-dx||enemy.patrol+.45>support.s[2]/2-dz)issues.push(`inimigo ${enemyIndex} alcança a borda`);if(!enemyPathHasHeadroom(enemy.p[0],enemy.p[2],enemy.patrol,top,supportIndex,level.platforms))issues.push(`inimigo ${enemyIndex} sob outro bloco`)});return issues;
}

export function validateLevel(level){
  const issues=[];const visited=new Set([0]);const queue=[0];while(queue.length){const fromIndex=queue.shift();const from=level.platforms[fromIndex];level.platforms.forEach((to,toIndex)=>{if(visited.has(toIndex)||toIndex===fromIndex)return;const horizontal=Math.hypot(to.p[0]-from.p[0],to.p[2]-from.p[2]);const reach=(Math.max(from.s[0],from.s[2])+Math.max(to.s[0],to.s[2]))*.34;const edgeGap=horizontal-reach;const rise=to.p[1]-from.p[1];if(edgeGap<=6.25&&rise<=3.55&&rise>=-5){visited.add(toIndex);queue.push(toIndex)}})}if(visited.size!==level.platforms.length)issues.push(`${level.platforms.length-visited.size} plataformas inacessíveis`);if(level.coins.length<Math.ceil(level.platforms.length/2))issues.push("poucas moedas");if(level.goal.length!==3)issues.push("objetivo ausente");issues.push(...validateCoinPlacements(level),...validatePlatformClearance(level),...validateEnemyPlacements(level));return issues
}

const MAP_X=[170,290,445,590,520,350,185,245,420,585,530,355,180,255,435,590,500,325,170,270,455,590,505,330,180];
export const CAMPAIGN_LEVELS=LEVEL_NAMES.map((name,index)=>{const x=MAP_X[index],y=70+index*112;const previous=index?{x:MAP_X[index-1],y:70+(index-1)*112}:null;return {number:index+1,name,gimmick:GIMMICKS[index],region:Math.floor(index/5)+1,map:{x,y},connector:previous?{x:previous.x,y:previous.y,length:Math.hypot(x-previous.x,y-previous.y),angle:Math.atan2(y-previous.y,x-previous.x)*180/Math.PI}:null}});
