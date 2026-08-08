export const CHARACTER_KEY="aurora-wilds-character-v1";
export const HAIR_STYLES=[
  {id:"ponytail",name:"Rabo de vento"},
  {id:"crop",name:"Curto de campo"},
  {id:"bob",name:"Corte viajante"},
  {id:"mohawk",name:"Crista selvagem"},
  {id:"buns",name:"Coques gêmeos"},
];
export const DEFAULT_CHARACTER={hairStyle:0,skinColor:"#f2c79c",hairColor:"#e6c469"};

const color=value=>typeof value==="string"&&/^#[0-9a-f]{6}$/i.test(value)?value:null;
export function normalizeCharacter(value){
  if(!value||typeof value!=="object")return{...DEFAULT_CHARACTER};
  return{hairStyle:Math.max(0,Math.min(HAIR_STYLES.length-1,Math.floor(Number(value.hairStyle)||0))),skinColor:color(value.skinColor)??DEFAULT_CHARACTER.skinColor,hairColor:color(value.hairColor)??DEFAULT_CHARACTER.hairColor};
}
export function hasCharacterAppearance(){if(typeof window==="undefined")return false;try{return Boolean(window.localStorage.getItem(CHARACTER_KEY));}catch{return false;}}
export function loadCharacterAppearance(){if(typeof window==="undefined")return{...DEFAULT_CHARACTER};try{return normalizeCharacter(JSON.parse(window.localStorage.getItem(CHARACTER_KEY)??"null"));}catch{return{...DEFAULT_CHARACTER};}}
export function saveCharacterAppearance(value){const normalized=normalizeCharacter(value);try{window.localStorage.setItem(CHARACTER_KEY,JSON.stringify(normalized));}catch{}return normalized;}
