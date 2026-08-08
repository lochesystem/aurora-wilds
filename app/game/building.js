export const BUILDING_PIECES = [
  {id:"foundation",name:"Fundação",description:"Base plana para o abrigo.",cost:{wood:3,stone:1},size:[3,.28,3],yOffset:.14,shelter:false,health:180,support:"ground"},
  {id:"wall",name:"Parede",description:"Fecha uma lateral do abrigo.",cost:{wood:3,stone:0},size:[3,2.7,.22],yOffset:1.35,shelter:false,health:120,support:"foundation"},
  {id:"door",name:"Porta",description:"Abre, fecha e protege a entrada.",cost:{wood:4,stone:0},size:[3,2.7,.22],yOffset:1.35,shelter:false,health:110,support:"foundation"},
  {id:"roof",name:"Telhado",description:"Cobertura plana modular.",cost:{wood:4,stone:0},size:[3.3,.25,3.3],yOffset:2.78,shelter:true,health:100,support:"wall"},
  {id:"slopedRoof",name:"Telhado inclinado",description:"Cobertura inclinada para fechar o abrigo.",cost:{wood:4,stone:0},size:[3.3,.3,3.3],yOffset:2.45,shelter:true,health:105,support:"wall"},
  {id:"stairs",name:"Escada",description:"Liga dois níveis da construção.",cost:{wood:4,stone:0},size:[1.4,1.5,3],yOffset:.75,shelter:false,health:110,support:"ground"},
  {id:"ramp",name:"Rampa",description:"Acesso inclinado largo para a fundação.",cost:{wood:4,stone:1},size:[3,.3,3],yOffset:.15,shelter:false,health:140,support:"ground"},
  {id:"chest",name:"Baú",description:"Guarda e devolve recursos coletados.",cost:{wood:4,stone:1},size:[1.25,.8,.75],yOffset:.4,shelter:false,health:80,support:"ground"},
  {id:"bed",name:"Cama",description:"Permite dormir até o amanhecer e define o ponto de retorno.",cost:{wood:3,stone:0},size:[1.2,.35,2.2],yOffset:.18,shelter:false,health:70,support:"ground"},
];

export function getBuildingPiece(pieceId){return BUILDING_PIECES.find(piece=>piece.id===pieceId)??null;}
export function canBuild(piece,inventory){return inventory.wood>=piece.cost.wood&&inventory.stone>=piece.cost.stone;}
export function snapToGrid(value,grid=1){return Math.round(value/grid)*grid;}
export function footprintsOverlap(a,b,padding=.15){return Math.abs(a.x-b.x)<(a.width+b.width)/2+padding&&Math.abs(a.z-b.z)<(a.depth+b.depth)/2+padding;}

const MODULE_SIZE=3;
const WALL_HEIGHT=2.7;
const FOUNDATION_TOP=.28;
const ROOF_SUPPORT_OFFSET=.05;
const WALL_IDS=new Set(["wall","door"]);
const ROOF_IDS=new Set(["roof","slopedRoof"]);

function normalizeRotation(rotation){
  const full=Math.PI*2;
  return ((rotation%full)+full)%full;
}

function rotationDistance(a,b){
  const difference=Math.abs(normalizeRotation(a)-normalizeRotation(b));
  return Math.min(difference,Math.PI*2-difference);
}

function horizontalDistance(a,b){return Math.hypot(a.x-b.x,a.z-b.z);}

function snapPriority(kind){return kind==="roof-side"?-.45:0;}

function addCandidate(candidates,candidate){
  const duplicateIndex=candidates.findIndex(current=>Math.abs(current.x-candidate.x)<.01&&Math.abs(current.y-candidate.y)<.01&&Math.abs(current.z-candidate.z)<.01&&rotationDistance(current.rotation,candidate.rotation)<.01);
  if(duplicateIndex<0)candidates.push(candidate);
  else if(snapPriority(candidate.kind)<snapPriority(candidates[duplicateIndex].kind))candidates[duplicateIndex]=candidate;
}

/**
 * Finds the modular connection nearest to the free placement target. Horizontal
 * distance drives the choice, so pointing at a wall stacks above it while
 * pointing beside it extends the same row.
 */
export function findBuildingSnap(pieceId,target,structures,maxDistance=2.15){
  const candidates=[];
  const add=(x,y,z,rotation,kind,label)=>addCandidate(candidates,{x,y,z,rotation:normalizeRotation(rotation),kind,label});

  for(const structure of structures){
    const {id,x,y,z}=structure;
    const rotation=normalizeRotation(structure.rotation??0);

    if(pieceId==="foundation"&&id==="foundation"){
      add(x+MODULE_SIZE,y,z,target.rotation,"foundation-side","Fundação conectada");
      add(x-MODULE_SIZE,y,z,target.rotation,"foundation-side","Fundação conectada");
      add(x,y,z+MODULE_SIZE,target.rotation,"foundation-side","Fundação conectada");
      add(x,y,z-MODULE_SIZE,target.rotation,"foundation-side","Fundação conectada");
    }

    if((pieceId==="stairs"||pieceId==="ramp")&&id==="foundation"){
      add(x+MODULE_SIZE,y,z,Math.PI/2,"access-side","Acesso conectado");add(x-MODULE_SIZE,y,z,Math.PI/2,"access-side","Acesso conectado");add(x,y,z+MODULE_SIZE,0,"access-side","Acesso conectado");add(x,y,z-MODULE_SIZE,0,"access-side","Acesso conectado");
    }

    if(WALL_IDS.has(pieceId)&&id==="foundation"){
      add(x,y+FOUNDATION_TOP,z+MODULE_SIZE/2,0,"foundation-edge","Encaixe na fundação");
      add(x,y+FOUNDATION_TOP,z-MODULE_SIZE/2,0,"foundation-edge","Encaixe na fundação");
      add(x+MODULE_SIZE/2,y+FOUNDATION_TOP,z,Math.PI/2,"foundation-edge","Encaixe na fundação");
      add(x-MODULE_SIZE/2,y+FOUNDATION_TOP,z,Math.PI/2,"foundation-edge","Encaixe na fundação");
    }

    if(WALL_IDS.has(pieceId)&&WALL_IDS.has(id)){
      const axisX=Math.cos(rotation),axisZ=-Math.sin(rotation);
      add(x+axisX*MODULE_SIZE,y,z+axisZ*MODULE_SIZE,rotation,"wall-side","Parede conectada");
      add(x-axisX*MODULE_SIZE,y,z-axisZ*MODULE_SIZE,rotation,"wall-side","Parede conectada");
      add(x,y+WALL_HEIGHT,z,rotation,"wall-top","Parede empilhada");
    }

    if(ROOF_IDS.has(pieceId)&&id==="foundation"){
      add(x,y+FOUNDATION_TOP+ROOF_SUPPORT_OFFSET,z,target.rotation,"roof-foundation","Telhado encaixado");
    }

    if(ROOF_IDS.has(pieceId)&&WALL_IDS.has(id)){
      const normalX=Math.sin(rotation),normalZ=Math.cos(rotation);
      add(x+normalX*MODULE_SIZE/2,y+ROOF_SUPPORT_OFFSET,z+normalZ*MODULE_SIZE/2,target.rotation,"roof-top","Telhado apoiado");
      add(x-normalX*MODULE_SIZE/2,y+ROOF_SUPPORT_OFFSET,z-normalZ*MODULE_SIZE/2,target.rotation,"roof-top","Telhado apoiado");
    }

    if(ROOF_IDS.has(pieceId)&&ROOF_IDS.has(id)){
      add(x+MODULE_SIZE,y,z,target.rotation,"roof-side","Telhado conectado");
      add(x-MODULE_SIZE,y,z,target.rotation,"roof-side","Telhado conectado");
      add(x,y,z+MODULE_SIZE,target.rotation,"roof-side","Telhado conectado");
      add(x,y,z-MODULE_SIZE,target.rotation,"roof-side","Telhado conectado");
    }
  }

  return candidates
    .map(candidate=>({candidate,distance:horizontalDistance(candidate,target),score:horizontalDistance(candidate,target)+rotationDistance(candidate.rotation,target.rotation)*.08+Math.abs(candidate.y-target.y)*.015+snapPriority(candidate.kind)}))
    .filter(entry=>entry.distance<=maxDistance)
    .sort((a,b)=>a.score-b.score)[0]?.candidate??null;
}

function orientedFootprint(piece,rotation){
  const quarter=Math.abs(Math.round(normalizeRotation(rotation)/(Math.PI/2)))%2;
  return {width:quarter?piece.size[2]:piece.size[0],depth:quarter?piece.size[0]:piece.size[2]};
}

function verticalOverlap(a,aPiece,b,bPiece){
  const aCenter=a.y+aPiece.yOffset,bCenter=b.y+bPiece.yOffset;
  return Math.abs(aCenter-bCenter)<(aPiece.size[1]+bPiece.size[1])/2-.015;
}

function wallJointAllowed(a,b){
  if(!WALL_IDS.has(a.id)||!WALL_IDS.has(b.id))return false;
  const perpendicular=Math.abs(Math.sin((a.rotation??0)-(b.rotation??0)))>.9;
  return perpendicular&&horizontalDistance(a,b)>1.35;
}

function roofJointAllowed(a,b){
  if(!ROOF_IDS.has(a.id)||!ROOF_IDS.has(b.id)||Math.abs(a.y-b.y)>.4)return false;
  const deltaX=Math.abs(a.x-b.x),deltaZ=Math.abs(a.z-b.z);
  return Math.abs(deltaX-MODULE_SIZE)<.08&&deltaZ<.08||Math.abs(deltaZ-MODULE_SIZE)<.08&&deltaX<.08;
}

/** Rejects duplicate/intersecting pieces while allowing supports and corner joints. */
export function buildingPlacementBlocked(candidate,structures){
  const candidatePiece=getBuildingPiece(candidate.id);
  if(!candidatePiece)return true;
  return structures.some(structure=>{
    const otherPiece=getBuildingPiece(structure.id);
    if(!otherPiece)return false;
    const comparable=candidate.id==="foundation"&&structure.id==="foundation"||
      WALL_IDS.has(candidate.id)&&WALL_IDS.has(structure.id)||
      ROOF_IDS.has(candidate.id)&&ROOF_IDS.has(structure.id)||
      ["chest","bed","stairs","ramp"].includes(candidate.id)&&["chest","bed","stairs","ramp"].includes(structure.id);
    if(!comparable||wallJointAllowed(candidate,structure)||roofJointAllowed(candidate,structure))return false;
    const a=orientedFootprint(candidatePiece,candidate.rotation??0),b=orientedFootprint(otherPiece,structure.rotation??0);
    return footprintsOverlap({x:candidate.x,z:candidate.z,...a},{x:structure.x,z:structure.z,...b},-.015)&&verticalOverlap(candidate,candidatePiece,structure,otherPiece);
  });
}

export function structureRefund(piece,ratio=.5){
  return{wood:Math.floor(piece.cost.wood*ratio),stone:Math.floor(piece.cost.stone*ratio)};
}

export function structureRepairCost(piece,health){
  const missing=Math.max(0,1-health/piece.health);
  return{wood:Math.ceil(piece.cost.wood*missing*.6),stone:Math.ceil(piece.cost.stone*missing*.6)};
}

export function isStructureSupported(candidate,structures){
  const piece=getBuildingPiece(candidate.id);if(!piece)return false;
  if(piece.support==="ground")return true;
  if(piece.support==="foundation")return structures.some(structure=>{
    if(structure.id==="foundation")return horizontalDistance(candidate,structure)<2.25&&Math.abs(candidate.y-structure.y)<.7;
    return WALL_IDS.has(structure.id)&&horizontalDistance(candidate,structure)<.25&&candidate.y-structure.y>2.55&&candidate.y-structure.y<2.85;
  });
  if(piece.support==="wall")return structures.some(structure=>WALL_IDS.has(structure.id)&&horizontalDistance(candidate,structure)<2.25&&Math.abs(candidate.y-structure.y)<.55)||structures.some(structure=>ROOF_IDS.has(structure.id)&&horizontalDistance(candidate,structure)<3.2&&Math.abs(candidate.y-structure.y)<.4);
  return true;
}

export function unsupportedStructuresAfterRemoval(target,structures){
  const remaining=structures.filter(structure=>structure!==target),supported=remaining.filter(structure=>getBuildingPiece(structure.id)?.support==="ground");
  let changed=true;while(changed){changed=false;for(const structure of remaining){if(supported.includes(structure))continue;if(isStructureSupported(structure,supported)){supported.push(structure);changed=true;}}}
  return remaining.filter(structure=>!supported.includes(structure));
}
