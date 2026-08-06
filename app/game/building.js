export const BUILDING_PIECES = [
  {id:"foundation",name:"Fundação",description:"Base plana para o abrigo.",cost:{wood:3,stone:1},size:[3,.28,3],yOffset:.14,shelter:false},
  {id:"wall",name:"Parede",description:"Fecha uma lateral do abrigo.",cost:{wood:3,stone:0},size:[3,2.7,.22],yOffset:1.35,shelter:false},
  {id:"door",name:"Portal",description:"Entrada aberta para o acampamento.",cost:{wood:4,stone:0},size:[3,2.7,.22],yOffset:1.35,shelter:false},
  {id:"roof",name:"Telhado",description:"Protege uma área contra o frio.",cost:{wood:4,stone:0},size:[3.3,.25,3.3],yOffset:2.78,shelter:true},
  {id:"chest",name:"Baú",description:"Guarda e devolve recursos coletados.",cost:{wood:4,stone:1},size:[1.25,.8,.75],yOffset:.4,shelter:false},
  {id:"bed",name:"Cama",description:"Define o ponto de retorno da expedição.",cost:{wood:3,stone:0},size:[1.2,.35,2.2],yOffset:.18,shelter:false},
];

export function getBuildingPiece(pieceId){return BUILDING_PIECES.find(piece=>piece.id===pieceId)??null;}
export function canBuild(piece,inventory){return inventory.wood>=piece.cost.wood&&inventory.stone>=piece.cost.stone;}
export function snapToGrid(value,grid=1){return Math.round(value/grid)*grid;}
export function footprintsOverlap(a,b,padding=.15){return Math.abs(a.x-b.x)<(a.width+b.width)/2+padding&&Math.abs(a.z-b.z)<(a.depth+b.depth)/2+padding;}
