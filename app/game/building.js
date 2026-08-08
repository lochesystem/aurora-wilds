export const BUILDING_PIECES = [
  {id:"foundation",name:"Fundação",description:"Base plana para o abrigo.",cost:{wood:3,stone:1},size:[3,.28,3],yOffset:.14,shelter:false},
  {id:"wall",name:"Parede",description:"Fecha uma lateral do abrigo.",cost:{wood:3,stone:0},size:[3,2.7,.22],yOffset:1.35,shelter:false},
  {id:"door",name:"Portal",description:"Entrada aberta para o acampamento.",cost:{wood:4,stone:0},size:[3,2.7,.22],yOffset:1.35,shelter:false},
  {id:"roof",name:"Telhado",description:"Protege uma área contra o frio.",cost:{wood:4,stone:0},size:[3.3,.25,3.3],yOffset:2.78,shelter:true},
  {id:"chest",name:"Baú",description:"Guarda e devolve recursos coletados.",cost:{wood:4,stone:1},size:[1.25,.8,.75],yOffset:.4,shelter:false},
  {id:"bed",name:"Cama",description:"Permite dormir até o amanhecer e define o ponto de retorno.",cost:{wood:3,stone:0},size:[1.2,.35,2.2],yOffset:.18,shelter:false},
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

    if(pieceId==="roof"&&id==="foundation"){
      add(x,y+FOUNDATION_TOP+ROOF_SUPPORT_OFFSET,z,target.rotation,"roof-foundation","Telhado encaixado");
    }

    if(pieceId==="roof"&&WALL_IDS.has(id)){
      const normalX=Math.sin(rotation),normalZ=Math.cos(rotation);
      add(x+normalX*MODULE_SIZE/2,y+ROOF_SUPPORT_OFFSET,z+normalZ*MODULE_SIZE/2,target.rotation,"roof-top","Telhado apoiado");
      add(x-normalX*MODULE_SIZE/2,y+ROOF_SUPPORT_OFFSET,z-normalZ*MODULE_SIZE/2,target.rotation,"roof-top","Telhado apoiado");
    }

    if(pieceId==="roof"&&id==="roof"){
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
  if(a.id!=="roof"||b.id!=="roof"||Math.abs(a.y-b.y)>.08)return false;
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
      candidate.id==="roof"&&structure.id==="roof"||
      ["chest","bed"].includes(candidate.id)&&["chest","bed"].includes(structure.id);
    if(!comparable||wallJointAllowed(candidate,structure)||roofJointAllowed(candidate,structure))return false;
    const a=orientedFootprint(candidatePiece,candidate.rotation??0),b=orientedFootprint(otherPiece,structure.rotation??0);
    return footprintsOverlap({x:candidate.x,z:candidate.z,...a},{x:structure.x,z:structure.z,...b},-.015)&&verticalOverlap(candidate,candidatePiece,structure,otherPiece);
  });
}
