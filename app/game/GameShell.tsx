"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { AuroraGame, WORLD_SEED, type GameSnapshot } from "./engine";
import { loadSettings, saveSettings, type GrassAmount } from "./settings";
import { CRAFTING_RECIPES } from "./crafting.js";
import { BUILDING_PIECES } from "./building.js";
import { CARRIED_EQUIPMENT_IDS, DEFAULT_EQUIPMENT, DEFAULT_HOTBAR, DEFAULT_WEAPON_SLOTS } from "./inventory.js";
import { moveGridSelection } from "./menu-navigation.js";
import { minimapHeading, minimapPosition } from "./minimap.js";
import { HAIR_STYLES, hasCharacterAppearance, loadCharacterAppearance, saveCharacterAppearance } from "./character-customization.js";
import type { PlayerAppearance } from "./models";

type Screen = "title" | "creator" | "playing" | "inventory" | "build" | "paused" | "settings" | "dead";
type InventoryTab="bag"|"craft";

const GRASS_OPTIONS:Array<{value:GrassAmount;label:string;description:string}>=[
  {value:"none",label:"Nenhuma",description:"Remove toda a grama para máximo desempenho."},
  {value:"low",label:"Pouca",description:"Vegetação leve com clareiras e transições orgânicas."},
  {value:"high",label:"Muita",description:"Campos densos com cobertura completa nas áreas férteis."},
];
const SKIN_COLORS=["#f6d4b2","#edbd91","#ce8e65","#a86448","#704536","#3f2c29"];
const HAIR_COLORS=["#e8c86d","#70452f","#342b2d","#b65435","#d98da4","#7b70c7","#4b9a8c","#e6e1d8"];

const EMPTY: GameSnapshot = {
  health:100, hunger:78, berries:0, rawMeat:0, cookedMeat:0, wood:0, stone:0,
  distance:0, chunks:25, biome:"Campos de Aurora", interaction:"", selectedSlot:0,hotbarSlots:[...DEFAULT_HOTBAR],equipmentSlots:{...DEFAULT_EQUIPMENT},weaponSlots:[...DEFAULT_WEAPON_SLOTS],coldProtection:0,heatProtection:0,
  axeDurability:0,pickaxeDurability:0,spearDurability:0,campfireKits:0,timeLabel:"07:00",isNight:false,temperature:18,nearFire:false,survivedNights:0,hammer:false,buildingPiece:"",buildingValid:false,buildingSnap:"",buildingIssue:"",sheltered:false,comboStep:0,comboBuffered:0,gamepad:"",nightEvent:"",
  playerX:0,playerZ:0,heading:0,climbStamina:100,climbing:false,underground:false,mapMarkers:[],
};

const INVENTORY_ITEMS = [
  {id:"hands",name:"Mãos",description:"Ataque sem equipamento."},
  {id:"provisions",name:"Frutos e carne",description:"Consome carne assada ou frutos."},
  {id:"axe",name:"Machado de pedra",description:"Ferramenta para madeira."},
  {id:"pickaxe",name:"Picareta de pedra",description:"Ferramenta para rochas."},
  {id:"campfire",name:"Fogueira",description:"Kit de fogueira fabricado."},
  {id:"wood",name:"Madeira",description:"Material de construção."},
  {id:"stone",name:"Pedra",description:"Material de fabricação."},
  {id:"hammer",name:"Martelo",description:"Abre o modo construção."},
  {id:"spear",name:"Lança de pedra",description:"Arma de caça com alcance."},
  {id:"rawMeat",name:"Carne crua",description:"Asse perto de uma fogueira."},
] as const;

type InventoryItem=(typeof INVENTORY_ITEMS)[number];
const ITEM_BY_ID=new Map<string,InventoryItem>(INVENTORY_ITEMS.map(item=>[item.id,item]));

function itemCount(itemId:string,snapshot:GameSnapshot){
  if(itemId==="provisions")return snapshot.berries+snapshot.cookedMeat;
  if(itemId==="campfire")return snapshot.campfireKits;
  if(itemId==="wood")return snapshot.wood;if(itemId==="stone")return snapshot.stone;if(itemId==="rawMeat")return snapshot.rawMeat;return null;
}
function itemDurability(itemId:string,snapshot:GameSnapshot){if(itemId==="axe")return snapshot.axeDurability;if(itemId==="pickaxe")return snapshot.pickaxeDurability;if(itemId==="spear")return snapshot.spearDurability;return null;}
function itemOwned(itemId:string,snapshot:GameSnapshot){const count=itemCount(itemId,snapshot),durability=itemDurability(itemId,snapshot);return itemId==="hands"||itemId==="hammer"&&snapshot.hammer||(count??0)>0||(durability??0)>0;}
function ItemIcon({itemId,snapshot}:{itemId:string;snapshot:GameSnapshot}){const owned=itemOwned(itemId,snapshot);if(!owned&&itemId!=="hands")return <span className="slot-placeholder"/>;if(itemId==="hands")return <span className="slot-icon hands-icon">✊</span>;if(itemId==="provisions")return snapshot.cookedMeat>0?<span className="slot-icon">🍖</span>:<span className="slot-icon berry-icon"><i/><i/><i/></span>;if(itemId==="axe")return <span className="slot-icon tool-icon axe-icon">⌁</span>;if(itemId==="pickaxe")return <span className="slot-icon tool-icon pickaxe-icon">⌁</span>;if(itemId==="campfire")return <span className="slot-icon campfire-icon">♨</span>;if(itemId==="wood")return <span className="slot-icon wood-icon">▰</span>;if(itemId==="stone")return <span className="slot-icon stone-icon">◆</span>;if(itemId==="hammer")return <span className="slot-icon tool-icon hammer-icon">⌕</span>;if(itemId==="spear")return <span className="slot-icon tool-icon spear-icon">↟</span>;if(itemId==="rawMeat")return <span className="slot-icon raw-meat-icon">●</span>;return null;}

export default function GameShell() {
  const canvasRef=useRef<HTMLCanvasElement>(null);
  const gameRef=useRef<AuroraGame|null>(null);
  const toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const menuPadButtons=useRef(new Set<number>());
  const [screen,setScreen]=useState<Screen>("title");
  const [snapshot,setSnapshot]=useState<GameSnapshot>(EMPTY);
  const [toast,setToast]=useState("");
  const [damageFlash,setDamageFlash]=useState(false);
  const [runId,setRunId]=useState(0);
  const [selectedRecipe,setSelectedRecipe]=useState(0);
  const [selectedBuildingPiece,setSelectedBuildingPiece]=useState(0);
  const [selectedInventoryIndex,setSelectedInventoryIndex]=useState(0);
  const [hotbarEditSlot,setHotbarEditSlot]=useState(0);
  const [inventoryTab,setInventoryTab]=useState<InventoryTab>("bag");
  const [menuActionIndex,setMenuActionIndex]=useState(0);
  const [settings,setSettings]=useState(loadSettings);
  const [appearance,setAppearance]=useState<PlayerAppearance>(loadCharacterAppearance);
  const [characterCreated,setCharacterCreated]=useState(hasCharacterAppearance);
  const [creatorSection,setCreatorSection]=useState(0);
  const ownedInventoryItems=INVENTORY_ITEMS.filter(item=>itemOwned(item.id,snapshot));
  const selectedInventoryItem=ownedInventoryItems[selectedInventoryIndex%Math.max(1,ownedInventoryItems.length)]??INVENTORY_ITEMS[0];

  const showToast=useCallback((message:string)=>{
    setToast(message);
    if(toastTimer.current)clearTimeout(toastTimer.current);
    toastTimer.current=setTimeout(()=>setToast(""),1800);
  },[]);

  useEffect(()=>{
    if(!canvasRef.current)return;
    const game=new AuroraGame(canvasRef.current,{
      onSnapshot:setSnapshot,
      onDeath:()=>setScreen("dead"),
      onToast:showToast,
      onDamage:()=>{setDamageFlash(false);requestAnimationFrame(()=>setDamageFlash(true));},
      onPause:()=>setScreen(current=>current==="playing"?"paused":current),
      onInventory:()=>setScreen("inventory"),
      onBuildMenu:()=>setScreen("build"),
    });
    gameRef.current=game;
    void game.init(loadSettings());
    return()=>{game.destroy();gameRef.current=null;};
  },[runId,showToast]);

  useEffect(()=>gameRef.current?.setPaused(screen!=="playing"),[screen]);
  useEffect(()=>{const frame=requestAnimationFrame(()=>setMenuActionIndex(0));return()=>cancelAnimationFrame(frame);},[screen]);
  useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current);},[]);

  const start=useCallback(()=>{
    setRunId(current=>current+1);
    setScreen("playing");
    setSnapshot(EMPTY);
    showToast("Explore, colete e sobreviva");
    canvasRef.current?.focus();
  },[showToast]);

  const updateAppearance=useCallback((change:Partial<PlayerAppearance>)=>{
    setAppearance(current=>{const next={...current,...change};gameRef.current?.applyCharacterAppearance(next);return next;});
  },[]);
  const openWorld=useCallback(()=>{
    if(!characterCreated){setCreatorSection(0);setScreen("creator");return;}
    start();
  },[characterCreated,start]);
  const confirmCharacter=useCallback(()=>{
    const saved=saveCharacterAppearance(appearance);setAppearance(saved);setCharacterCreated(true);gameRef.current?.setCreatorPreview(false);start();
  },[appearance,start]);
  const cycleCreatorValue=useCallback((direction:number)=>{
    if(creatorSection===0)updateAppearance({hairStyle:(appearance.hairStyle+direction+HAIR_STYLES.length)%HAIR_STYLES.length});
    if(creatorSection===1){const current=Math.max(0,SKIN_COLORS.indexOf(appearance.skinColor));updateAppearance({skinColor:SKIN_COLORS[(current+direction+SKIN_COLORS.length)%SKIN_COLORS.length]});}
    if(creatorSection===2){const current=Math.max(0,HAIR_COLORS.indexOf(appearance.hairColor));updateAppearance({hairColor:HAIR_COLORS[(current+direction+HAIR_COLORS.length)%HAIR_COLORS.length]});}
  },[appearance,creatorSection,updateAppearance]);

  useEffect(()=>{
    if(screen!=="creator"){gameRef.current?.setCreatorPreview(false);return;}
    gameRef.current?.applyCharacterAppearance(appearance);gameRef.current?.setCreatorPreview(true);
  },[screen,appearance]);

  const resume=useCallback(()=>{setScreen("playing");canvasRef.current?.focus();},[]);
  const assignInventoryItem=useCallback((itemId:string,slot=hotbarEditSlot)=>{gameRef.current?.setHotbarSlot(slot,itemId);setHotbarEditSlot(slot);},[hotbarEditSlot]);
  const changeGrass=useCallback((grassAmount:GrassAmount)=>{
    setSettings(current=>{const next={...current,grassAmount};saveSettings(next);gameRef.current?.applySettings(next);return next;});
  },[]);
  const cycleGrass=useCallback((direction:number)=>{
    setSettings(current=>{const index=GRASS_OPTIONS.findIndex(option=>option.value===current.grassAmount);const grassAmount=GRASS_OPTIONS[(index+direction+GRASS_OPTIONS.length)%GRASS_OPTIONS.length].value;const next={...current,grassAmount};saveSettings(next);gameRef.current?.applySettings(next);return next;});
  },[]);

  useEffect(()=>{
    if(screen==="playing")return;
    let frame=0;
    const heldAtOpen=new Set<number>();
    Array.from(navigator.getGamepads?.()??[]).find(Boolean)?.buttons.forEach((button,index)=>{if(button.pressed||button.value>.55)heldAtOpen.add(index);});
    menuPadButtons.current=heldAtOpen;
    const tick=()=>{
      const pad=Array.from(navigator.getGamepads?.()??[]).find(Boolean);
      const next=new Set<number>();
      pad?.buttons.forEach((button,index)=>{if(button.pressed||button.value>.55)next.add(index);});
      const justPressed=(index:number)=>next.has(index)&&!menuPadButtons.current.has(index);
      if(screen==="creator"&&justPressed(12))setCreatorSection(current=>(current+3)%4);
      else if(screen==="creator"&&justPressed(13))setCreatorSection(current=>(current+1)%4);
      else if(screen==="creator"&&justPressed(14))cycleCreatorValue(-1);
      else if(screen==="creator"&&justPressed(15))cycleCreatorValue(1);
      else if(screen==="creator"&&justPressed(4))gameRef.current?.rotateCharacterPreview(-1);
      else if(screen==="creator"&&justPressed(5))gameRef.current?.rotateCharacterPreview(1);
      else if(screen==="inventory"&&justPressed(6))setInventoryTab("bag");
      else if(screen==="inventory"&&justPressed(7))setInventoryTab("craft");
      else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(2))assignInventoryItem(selectedInventoryItem.id);
      else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(3))gameRef.current?.equipWeapon(selectedInventoryItem.id);
      else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(4))setHotbarEditSlot(current=>(current+8)%9);
      else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(5))setHotbarEditSlot(current=>(current+1)%9);
      else if(screen==="paused"&&(justPressed(12)||justPressed(14)))setMenuActionIndex(current=>moveGridSelection(current,3,1,"up"));
      else if(screen==="paused"&&(justPressed(13)||justPressed(15)))setMenuActionIndex(current=>moveGridSelection(current,3,1,"down"));
      else if(screen==="dead"&&(justPressed(12)||justPressed(14)))setMenuActionIndex(current=>moveGridSelection(current,2,1,"up"));
      else if(screen==="dead"&&(justPressed(13)||justPressed(15)))setMenuActionIndex(current=>moveGridSelection(current,2,1,"down"));
      else if(justPressed(0)){
        if(screen==="inventory"){if(inventoryTab==="craft")gameRef.current?.craft(CRAFTING_RECIPES[selectedRecipe].id);else assignInventoryItem(selectedInventoryItem.id);}
        else if(screen==="build"){gameRef.current?.startBuilding(BUILDING_PIECES[selectedBuildingPiece].id);resume();}
        else if(screen==="paused"){if(menuActionIndex===0)resume();else if(menuActionIndex===1)setScreen("settings");else setScreen("title");}
        else if(screen==="dead"){if(menuActionIndex===0)start();else setScreen("title");}
        else if(screen==="creator"){if(creatorSection===3)confirmCharacter();else setCreatorSection(current=>Math.min(3,current+1));}
        else if(screen==="title")openWorld();
      }else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(14))setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"left"));
      else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(15))setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"right"));
      else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(12))setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"up"));
      else if(screen==="inventory"&&inventoryTab==="bag"&&justPressed(13))setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"down"));
      else if(screen==="inventory"&&inventoryTab==="craft"&&justPressed(12))setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"up"));
      else if(screen==="inventory"&&inventoryTab==="craft"&&justPressed(13))setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"down"));
      else if(screen==="inventory"&&inventoryTab==="craft"&&justPressed(14))setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"left"));
      else if(screen==="inventory"&&inventoryTab==="craft"&&justPressed(15))setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"right"));
      else if(screen==="build"&&justPressed(12))setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"up"));
      else if(screen==="build"&&justPressed(13))setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"down"));
      else if(screen==="build"&&justPressed(14))setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"left"));
      else if(screen==="build"&&justPressed(15))setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"right"));
      else if(screen==="settings"&&(justPressed(12)||justPressed(14)))cycleGrass(-1);
      else if(screen==="settings"&&(justPressed(13)||justPressed(15)))cycleGrass(1);
      else if((justPressed(9)||justPressed(17))&&screen==="inventory")resume();
      else if((justPressed(1)||justPressed(17))&&screen==="build")resume();
      else if(justPressed(9)&&screen==="paused")resume();
      else if(justPressed(1)&&screen==="inventory")resume();
      else if(justPressed(1)&&screen==="settings")setScreen("paused");
      else if(justPressed(1)&&screen==="creator")setScreen("title");
      else if(justPressed(1)&&(screen==="paused"||screen==="dead"))setScreen("title");
      menuPadButtons.current=next;
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[screen,start,openWorld,confirmCharacter,creatorSection,cycleCreatorValue,resume,selectedRecipe,selectedBuildingPiece,selectedInventoryItem,ownedInventoryItems.length,inventoryTab,assignInventoryItem,cycleGrass,menuActionIndex]);

  useEffect(()=>{
    if(screen!=="creator")return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){setScreen("title");return;}
      if(event.key==="ArrowUp"){event.preventDefault();setCreatorSection(current=>(current+3)%4);}
      if(event.key==="ArrowDown"){event.preventDefault();setCreatorSection(current=>(current+1)%4);}
      if(event.key==="ArrowLeft"){event.preventDefault();cycleCreatorValue(-1);}
      if(event.key==="ArrowRight"){event.preventDefault();cycleCreatorValue(1);}
      if(event.key.toLowerCase()==="q")gameRef.current?.rotateCharacterPreview(-1);
      if(event.key.toLowerCase()==="e")gameRef.current?.rotateCharacterPreview(1);
      if(event.key==="Enter"){if(creatorSection===3)confirmCharacter();else setCreatorSection(current=>Math.min(3,current+1));}
    };
    window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);
  },[screen,creatorSection,cycleCreatorValue,confirmCharacter]);

  useEffect(()=>{
    if(screen!=="inventory")return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()==="i"||event.key==="Escape"){resume();return;}
      if(event.key==="Tab"){event.preventDefault();setInventoryTab(current=>current==="bag"?"craft":"bag");return;}
      if(inventoryTab==="bag"&&event.key==="ArrowLeft")setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"left"));
      if(inventoryTab==="bag"&&event.key==="ArrowRight")setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"right"));
      if(inventoryTab==="bag"&&event.key==="ArrowUp")setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"up"));
      if(inventoryTab==="bag"&&event.key==="ArrowDown")setSelectedInventoryIndex(current=>moveGridSelection(current,ownedInventoryItems.length,5,"down"));
      if(inventoryTab==="craft"&&event.key==="ArrowLeft")setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"left"));
      if(inventoryTab==="craft"&&event.key==="ArrowRight")setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"right"));
      if(inventoryTab==="craft"&&event.key==="ArrowUp")setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"up"));
      if(inventoryTab==="craft"&&event.key==="ArrowDown")setSelectedRecipe(current=>moveGridSelection(current,CRAFTING_RECIPES.length,2,"down"));
      if(inventoryTab==="bag"&&(event.key===" "||event.key==="Enter")){event.preventDefault();assignInventoryItem(selectedInventoryItem.id);}
      if(inventoryTab==="craft"&&event.key==="Enter")gameRef.current?.craft(CRAFTING_RECIPES[selectedRecipe].id);
    };
    window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);
  },[screen,resume,selectedRecipe,selectedInventoryItem,ownedInventoryItems.length,inventoryTab,assignInventoryItem]);

  useEffect(()=>{
    if(screen!=="build")return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()==="i"||event.key==="Escape"){resume();return;}
      if(event.key==="ArrowLeft")setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"left"));
      if(event.key==="ArrowRight")setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"right"));
      if(event.key==="ArrowUp")setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"up"));
      if(event.key==="ArrowDown")setSelectedBuildingPiece(current=>moveGridSelection(current,BUILDING_PIECES.length,2,"down"));
      if(event.key==="Enter"){gameRef.current?.startBuilding(BUILDING_PIECES[selectedBuildingPiece].id);resume();}
    };
    window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);
  },[screen,resume,selectedBuildingPiece]);

  useEffect(()=>{
    if(screen!=="settings")return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==="Escape"){setScreen("paused");return;}
      if(event.key==="ArrowLeft"||event.key==="ArrowUp")cycleGrass(-1);
      if(event.key==="ArrowRight"||event.key==="ArrowDown")cycleGrass(1);
    };
    window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);
  },[screen,cycleGrass]);
  const healthColor=snapshot.health<30?"danger":"";
  const hungerColor=snapshot.hunger<25?"danger":snapshot.hunger<50?"warning":"";

  return (
    <main className="game-root survival-root">
      <canvas ref={canvasRef} className="game-canvas" tabIndex={0} aria-label="Aurora Wilds, jogo de sobrevivência 3D em mundo procedural" />

      <div className={`hud survival-hud ${screen!=="playing"?"hidden":""}`} aria-live="polite">
        <div className="survival-status"><div className="survival-brand"><span>Região</span><strong>{snapshot.biome}</strong><small>Seed {WORLD_SEED}</small></div></div>

        <div className="world-stats">
          <span className={snapshot.isNight?"night-stat":""}><b>{snapshot.timeLabel}</b> {snapshot.isNight?"noite":"dia"}</span>
          <span className={snapshot.temperature<5?"cold-stat":snapshot.nearFire||snapshot.sheltered?"warm-stat":""}><b>{snapshot.temperature}°</b> {snapshot.nearFire?"aquecido":snapshot.sheltered?"abrigado":"ambiente"}</span>
          <span><b>{snapshot.distance}m</b> da origem</span>
        </div>

        <div className={`minimap ${snapshot.underground?"underground":""}`} aria-label={`Minimapa de ${snapshot.biome}`}>
          <span className="minimap-north">N</span>
          <div className="minimap-rings" />
          {snapshot.mapMarkers.map((marker,index)=>{const {left,top}=minimapPosition(marker.x,marker.z);return <i key={`${marker.kind}-${index}`} className={`map-marker ${marker.kind} ${marker.looted?"looted":""}`} style={{left:`${left}%`,top:`${top}%`}} title={marker.kind}/>;})}
          <i className="map-player" style={{transform:`translate(-50%,-50%) rotate(${minimapHeading(snapshot.heading)}rad)`}} />
          <small>{snapshot.underground?"Subsolo":`${Math.round(snapshot.playerX)}, ${Math.round(snapshot.playerZ)}`}</small>
        </div>

        <div className={`survival-objective ${snapshot.survivedNights>0?"complete":snapshot.isNight?"urgent":""}`}><span>{snapshot.isNight?snapshot.nightEvent:snapshot.survivedNights>0?"Objetivo concluído":"Prepare-se antes do anoitecer"}</span><strong>{snapshot.isNight?"Predadores podem atacar você e suas estruturas":snapshot.survivedNights>0?"Explore rios, biomas e ruínas":"Fabrique ferramentas e uma fogueira"}</strong></div>

        <div className="survival-vitals" aria-label="Estado do personagem">
          <div className="vital-line health-line"><span>♥</span><i className={healthColor}><em style={{width:`${snapshot.health}%`}} /></i><b>{snapshot.health}</b></div>
          <div className="vital-line hunger-line"><span>◆</span><i className={hungerColor}><em style={{width:`${snapshot.hunger}%`}} /></i><b>{snapshot.hunger}</b></div>
          {(snapshot.climbing||snapshot.climbStamina<100)&&<div className="climb-stamina"><span>Escalada</span><i><em style={{width:`${snapshot.climbStamina}%`}}/></i><b>{snapshot.climbStamina}</b></div>}
        </div>

        <div className="hotbar-wrap">
          <div className="selected-item-name">{ITEM_BY_ID.get(snapshot.hotbarSlots[snapshot.selectedSlot])?.name??"Atalho vazio"}</div>
          <div className="hotbar" aria-label="Barra de acesso rápido">
            {snapshot.hotbarSlots.map((itemId,index)=>{const item=ITEM_BY_ID.get(itemId),count=itemCount(itemId,snapshot),durability=itemDurability(itemId,snapshot),occupied=itemOwned(itemId,snapshot);
              return <button key={index} type="button" className={`hotbar-slot ${snapshot.selectedSlot===index?"selected":""} ${occupied?"occupied":"empty"}`} aria-label={`${index+1}: ${item?.name??"vazio"}${count!==null?`, quantidade ${count}`:""}`} aria-pressed={snapshot.selectedSlot===index} onClick={()=>gameRef.current?.selectHotbarSlot(index)}>
                <span className="slot-key">{index+1}</span>
                <ItemIcon itemId={itemId} snapshot={snapshot}/>
                {count!==null&&count>0&&<b className="stack-count">{count}</b>}
                {durability!==null&&durability>0&&<i className="durability"><em style={{width:`${durability}%`}}/></i>}
              </button>;
            })}
          </div>
        </div>

        {snapshot.buildingPiece?<div className={`building-prompt ${snapshot.buildingValid?"valid":"invalid"}`}><strong>{snapshot.buildingPiece}</strong><span>{snapshot.buildingValid?(snapshot.buildingSnap||"Posicionamento livre"):(snapshot.buildingIssue||"Não é possível construir aqui")}</span></div>:snapshot.interaction&&<div className="interaction-prompt">{snapshot.interaction}</div>}
        {snapshot.comboStep>0&&<div className={`combo-indicator step-${snapshot.comboStep}`}><span>Combo</span><b>{snapshot.comboStep}</b><small>{snapshot.comboStep===3?"finalização":snapshot.comboBuffered>0?"golpe encadeado":"ataque novamente"}</small></div>}
        <div className={`survival-controls ${snapshot.gamepad?"controller-controls":""}`}>
          {snapshot.buildingPiece?(snapshot.gamepad?<><span className="controller-name">Modo construção</span><span><kbd>△</kbd> construir</span><span><kbd>L2/R2</kbd> girar</span><span><kbd>○</kbd> cancelar</span></>:<><span><kbd>Q</kbd> construir</span><span><kbd>R</kbd> girar</span><span><kbd>Esc</kbd> cancelar</span></>):snapshot.gamepad?<><span className="controller-name">{snapshot.gamepad}</span><span><kbd>L1/R1</kbd> slots</span><span><kbd>□</kbd> interagir</span><span><kbd>△</kbd> atacar / reparar</span><span><kbd>✕ segurar</kbd> escalar</span><span><kbd>R3</kbd> desmontar</span><span><kbd>○</kbd> dormir</span><span><kbd>Touchpad</kbd> inventário</span></>:<><span><kbd>WASD</kbd> mover</span><span><kbd>Espaço segurar</kbd> escalar</span><span><kbd>Scroll / 1–9</kbd> selecionar</span><span><kbd>I</kbd> inventário</span><span><kbd>E</kbd> interagir / pescar</span><span><kbd>Q</kbd> atacar / reparar</span><span><kbd>X</kbd> desmontar</span><span><kbd>F</kbd> dormir</span></>}
        </div>
      </div>

      <div className={`toast ${toast?"show":""}`}>{toast}</div>
      <div className={`damage-flash ${damageFlash?"show":""}`} onAnimationEnd={()=>setDamageFlash(false)} />

      <section className={`screen survival-title ${screen!=="title"?"hidden":""}`}>
        <div className="wilds-title-copy">
          <p className="eyebrow">Uma expedição de sobrevivência</p>
          <h1>Aurora <span>Wilds</span></h1>
          <p className="title-tagline">Um mundo vivo nasce ao seu redor. Explore, construa um abrigo e sobreviva às criaturas da noite.</p>
          <div className="survival-features" aria-label="Recursos do jogo"><span><b>∞</b> mundo procedural</span><span><b>⌂</b> construa livremente</span><span><b>◇</b> explore o desconhecido</span></div>
          <button className="primary-btn survival-enter-btn" onClick={openWorld}>{characterCreated?"Entrar no mundo":"Criar personagem"} <small>✕</small></button>
          <small className="title-local-note">Progresso salvo neste navegador</small>
        </div>
      </section>

      <section className={`screen character-creator ${screen!=="creator"?"hidden":""}`}>
        <header className="creator-heading"><p className="eyebrow">Antes da primeira alvorada</p><h2>Crie seu explorador</h2><p>Este será o seu personagem em Aurora Wilds.</p></header>
        <aside className="creator-controls">
          <section className={creatorSection===0?"selected":""} onMouseEnter={()=>setCreatorSection(0)}>
            <div className="creator-section-title"><span>01</span><div><strong>Cabelo</strong><small>{HAIR_STYLES[appearance.hairStyle].name}</small></div></div>
            <div className="hair-style-grid" role="radiogroup" aria-label="Modelo de cabelo">{HAIR_STYLES.map((style,index)=><button key={style.id} type="button" role="radio" aria-checked={appearance.hairStyle===index} className={appearance.hairStyle===index?"active":""} onClick={()=>{setCreatorSection(0);updateAppearance({hairStyle:index});}} title={style.name}><span className={`hair-thumb hair-${style.id}`}><i/></span><small>{style.name}</small></button>)}</div>
          </section>
          <section className={creatorSection===1?"selected":""} onMouseEnter={()=>setCreatorSection(1)}>
            <div className="creator-section-title"><span>02</span><div><strong>Tom de pele</strong><small>Escolha uma amostra ou qualquer cor</small></div><label className="custom-color" style={{"--picker-color":appearance.skinColor} as CSSProperties}><input type="color" value={appearance.skinColor} onChange={event=>updateAppearance({skinColor:event.target.value})}/><i/> Personalizar</label></div>
            <div className="color-swatches">{SKIN_COLORS.map(color=><button key={color} type="button" aria-label={`Pele ${color}`} aria-pressed={appearance.skinColor===color} style={{background:color}} onClick={()=>{setCreatorSection(1);updateAppearance({skinColor:color});}}/>)}</div>
          </section>
          <section className={creatorSection===2?"selected":""} onMouseEnter={()=>setCreatorSection(2)}>
            <div className="creator-section-title"><span>03</span><div><strong>Cor do cabelo</strong><small>Do natural ao fantástico</small></div><label className="custom-color" style={{"--picker-color":appearance.hairColor} as CSSProperties}><input type="color" value={appearance.hairColor} onChange={event=>updateAppearance({hairColor:event.target.value})}/><i/> Personalizar</label></div>
            <div className="color-swatches">{HAIR_COLORS.map(color=><button key={color} type="button" aria-label={`Cabelo ${color}`} aria-pressed={appearance.hairColor===color} style={{background:color}} onClick={()=>{setCreatorSection(2);updateAppearance({hairColor:color});}}/>)}</div>
          </section>
          <button className={`creator-confirm ${creatorSection===3?"selected":""}`} onMouseEnter={()=>setCreatorSection(3)} onClick={confirmCharacter}><span>Pronto para explorar</span><strong>Começar aventura</strong><kbd>✕</kbd></button>
        </aside>
        <div className="creator-preview-help"><span><kbd>L1</kbd><kbd>R1</kbd> girar personagem</span><span><kbd>↑ ↓ ← →</kbd> navegar</span><button onClick={()=>setScreen("title")}>Voltar <kbd>○</kbd></button></div>
      </section>

      <section className={`screen ${screen!=="paused"?"hidden":""}`}>
        <div className="pause-card"><p className="eyebrow">Expedição interrompida</p><h2>Pausado</h2><p>O mundo espera. Fome e simulação estão congeladas.</p><div className="menu-actions"><button className={`primary-btn ${menuActionIndex===0?"controller-selected":""}`} onMouseEnter={()=>setMenuActionIndex(0)} onClick={resume}>Continuar <small>✕</small></button><button className={`secondary-btn ${menuActionIndex===1?"controller-selected":""}`} onMouseEnter={()=>setMenuActionIndex(1)} onClick={()=>setScreen("settings")}>Configurações</button><button className={`secondary-btn ${menuActionIndex===2?"controller-selected":""}`} onMouseEnter={()=>setMenuActionIndex(2)} onClick={()=>setScreen("title")}>Sair ao título <small>○</small></button></div></div>
      </section>

      <section className={`screen ${screen!=="settings"?"hidden":""}`}>
        <div className="pause-card grass-settings-card"><p className="eyebrow">Desempenho e visual</p><h2>Vegetação</h2><p>Escolha quanta grama será desenhada no mundo.</p><div className="grass-options" role="radiogroup" aria-label="Quantidade de grama">{GRASS_OPTIONS.map(option=><button key={option.value} type="button" role="radio" aria-checked={settings.grassAmount===option.value} className={settings.grassAmount===option.value?"selected":""} onClick={()=>changeGrass(option.value)}><strong>{option.label}</strong><small>{option.description}</small></button>)}</div><div className="settings-hint"><span><kbd>← →</kbd> escolher</span><span><kbd>○ / Esc</kbd> voltar</span></div><button className="primary-btn" onClick={()=>setScreen("paused")}>Voltar</button></div>
      </section>

      <section className={`screen inventory-screen ${screen!=="inventory"?"hidden":""}`}>
        <div className="inventory-modal simple-inventory-modal">
          <header><div><p className="eyebrow">Equipamento de campo</p><h2>{inventoryTab==="bag"?"Inventário":"Fabricação"}</h2></div><nav className="inventory-tabs" aria-label="Seções do inventário"><button className={inventoryTab==="bag"?"selected":""} onClick={()=>setInventoryTab("bag")}><kbd>L2</kbd> Mochila</button><button className={inventoryTab==="craft"?"selected":""} onClick={()=>setInventoryTab("craft")}>Fabricar <kbd>R2</kbd></button></nav><button className="icon-btn" onClick={resume} aria-label="Fechar inventário">×</button></header>
          {inventoryTab==="bag"?<>
            <div className="simple-inventory-body">
              <section className="backpack-panel">
                <div className="inventory-section-heading"><div><strong>Mochila</strong><small>Use os direcionais ou clique em um item</small></div><span>{ownedInventoryItems.length} tipos</span></div>
                <div className="simple-item-grid" role="list" aria-label="Itens do jogador">
                  {ownedInventoryItems.map((item,index)=>{const count=itemCount(item.id,snapshot),durability=itemDurability(item.id,snapshot);return <button key={item.id} type="button" role="listitem" draggable className={`simple-item-slot ${selectedInventoryIndex%ownedInventoryItems.length===index?"selected":""}`} onClick={()=>setSelectedInventoryIndex(index)} onDoubleClick={()=>assignInventoryItem(item.id)} onDragStart={event=>{event.dataTransfer.setData("text/plain",item.id);event.dataTransfer.effectAllowed="move";setSelectedInventoryIndex(index);}} aria-label={item.name}>
                    <ItemIcon itemId={item.id} snapshot={snapshot}/>{count!==null&&<b>{count}</b>}{durability!==null&&<i><em style={{width:`${durability}%`}}/></i>}
                  </button>;})}
                  {Array.from({length:Math.max(0,20-ownedInventoryItems.length)},(_,index)=><span className="simple-item-slot empty" key={`empty-${index}`} aria-hidden="true"/>)}
                </div>
                <div className="selected-item-detail"><span className="inventory-item-icon"><ItemIcon itemId={selectedInventoryItem.id} snapshot={snapshot}/></span><div><strong>{selectedInventoryItem.name}</strong><small>{selectedInventoryItem.description}</small></div>{CARRIED_EQUIPMENT_IDS.includes(selectedInventoryItem.id)&&<button onClick={()=>gameRef.current?.equipWeapon(selectedInventoryItem.id)}>Equipar <kbd>△</kbd></button>}<button onClick={()=>assignInventoryItem(selectedInventoryItem.id)}>Atalho {hotbarEditSlot+1} <kbd>□</kbd></button></div>
              </section>
              <aside className="character-equipment" aria-label="Personagem e roupas equipadas">
                <div className="equipment-title"><span>Expedicionário</span><strong>Equipamento</strong></div>
                <div className="character-stage">
                  <div className="equipment-slots left"><button><span>◉</span><small>Cabeça</small><b>{snapshot.equipmentSlots.head||"Vazio"}</b></button><button><span>▰</span><small>Tronco</small><b>{snapshot.equipmentSlots.body||"Vazio"}</b></button></div>
                  <div className="character-mannequin" aria-label="Visual do personagem"><i className="mannequin-antenna"/><i className="mannequin-head"/><i className="mannequin-scarf"/><i className="mannequin-body"/><i className="mannequin-arm left"/><i className="mannequin-arm right"/><i className="mannequin-leg left"/><i className="mannequin-leg right"/></div>
                  <div className="equipment-slots right"><button><span>▥</span><small>Pernas</small><b>{snapshot.equipmentSlots.legs||"Vazio"}</b></button><button><span>⌁</span><small>Pés</small><b>{snapshot.equipmentSlots.feet||"Vazio"}</b></button></div>
                </div>
                <div className="weapon-loadout"><span>Ferramentas equipadas</span><div>{snapshot.weaponSlots.map((itemId,index)=><button key={index} className={snapshot.hotbarSlots[snapshot.selectedSlot]===itemId?"active":""} onClick={()=>gameRef.current?.setWeaponSlot(index,selectedInventoryItem.id)}><small>{index+1}</small><strong>{ITEM_BY_ID.get(itemId)?.name??"Vazio"}</strong></button>)}</div><small>Ativa na mão; a outra fica nas costas.</small></div>
                <div className="equipped-hand"><span>Mão ativa</span><strong>{ITEM_BY_ID.get(snapshot.hotbarSlots[snapshot.selectedSlot])?.name??"Nenhum item"}</strong></div>
                <div className="thermal-protection"><span><b>❄ {snapshot.coldProtection}</b> frio</span><span><b>☀ {snapshot.heatProtection}</b> calor</span><small>Roupas futuras aumentarão estas proteções.</small></div>
              </aside>
            </div>
            <div className="simple-hotbar-editor"><div><strong>Atalhos rápidos</strong><small><kbd>L1/R1</kbd> escolher · solte ou pressione <kbd>□</kbd></small></div><div className="inventory-hotbar" aria-label="Configuração da barra de atalhos">{snapshot.hotbarSlots.map((itemId,index)=>{const item=ITEM_BY_ID.get(itemId),count=itemCount(itemId,snapshot);return <button key={index} type="button" draggable={Boolean(itemId)} className={`inventory-hotbar-slot ${hotbarEditSlot===index?"selected":""}`} onClick={()=>{setHotbarEditSlot(index);assignInventoryItem(selectedInventoryItem.id,index);}} onDragStart={event=>{if(itemId){event.dataTransfer.setData("text/plain",itemId);event.dataTransfer.effectAllowed="move";}}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(ITEM_BY_ID.has(dropped))assignInventoryItem(dropped,index);}} aria-label={`Atalho ${index+1}: ${item?.name??"vazio"}`}><span>{index+1}</span><ItemIcon itemId={itemId} snapshot={snapshot}/>{count!==null&&count>0&&<b>{count}</b>}</button>;})}</div></div>
          </>:<>
            <div className="inventory-summary"><span><b>{snapshot.wood}</b> madeira</span><span><b>{snapshot.stone}</b> pedra</span></div>
            <div className="recipe-list simple-crafting-list">{CRAFTING_RECIPES.map((recipe,index)=>{const affordable=snapshot.wood>=recipe.cost.wood&&snapshot.stone>=recipe.cost.stone;return <button key={recipe.id} className={`recipe-card ${selectedRecipe===index?"selected":""} ${affordable?"affordable":"locked"}`} onMouseEnter={()=>setSelectedRecipe(index)} onClick={()=>gameRef.current?.craft(recipe.id)}><span className={`recipe-icon ${recipe.id}`}>{recipe.id==="campfire"?"♨":recipe.id==="spear"?"↟":"⌁"}</span><div><strong>{recipe.name}</strong><small>{recipe.description}</small><em><i className={snapshot.wood>=recipe.cost.wood?"ready":""}>▰ {recipe.cost.wood}</i><i className={snapshot.stone>=recipe.cost.stone?"ready":""}>◆ {recipe.cost.stone}</i></em></div><kbd>{selectedRecipe===index?"✕":""}</kbd></button>;})}</div>
          </>}
          <footer>{inventoryTab==="bag"?<><span><kbd>Direcionais</kbd> navegar</span><span><kbd>L1/R1</kbd> atalho</span><span><kbd>□ / ✕</kbd> colocar</span></>:<><span><kbd>Direcionais</kbd> navegar livremente</span><span><kbd>✕</kbd> fabricar</span></>}<span><kbd>○ / I</kbd> voltar</span></footer>
        </div>
      </section>

      <section className={`screen inventory-screen ${screen!=="build"?"hidden":""}`}>
        <div className="inventory-modal building-modal">
          <header><div><p className="eyebrow">Martelo equipado</p><h2>Construir acampamento</h2></div><button className="icon-btn" onClick={resume} aria-label="Fechar menu de construção">×</button></header>
          <div className="inventory-summary"><span><b>{snapshot.wood}</b> madeira</span><span><b>{snapshot.stone}</b> pedra</span><span><b>Local</b> save automático</span></div>
          <div className="recipe-list building-list">
            {BUILDING_PIECES.map((piece,index)=>{const affordable=snapshot.wood>=piece.cost.wood&&snapshot.stone>=piece.cost.stone;return <button key={piece.id} className={`recipe-card building-card ${selectedBuildingPiece===index?"selected":""} ${affordable?"affordable":"locked"}`} onMouseEnter={()=>setSelectedBuildingPiece(index)} onClick={()=>{gameRef.current?.startBuilding(piece.id);resume();}}>
              <span className={`recipe-icon building-icon ${piece.id}`}>{piece.id==="foundation"?"▦":piece.id==="wall"?"▥":piece.id==="door"?"Π":piece.id==="roof"?"⌂":piece.id==="slopedRoof"?"⌃":piece.id==="stairs"?"≋":piece.id==="ramp"?"╱":piece.id==="chest"?"▣":"▱"}</span><div><strong>{piece.name}</strong><small>{piece.description}</small><em><i className={snapshot.wood>=piece.cost.wood?"ready":""}>▰ {piece.cost.wood}</i><i className={snapshot.stone>=piece.cost.stone?"ready":""}>◆ {piece.cost.stone}</i></em></div><kbd>{selectedBuildingPiece===index?"✕":""}</kbd>
            </button>;})}
          </div>
          <footer><span><kbd>Direcionais</kbd> navegar livremente</span><span><kbd>✕ / Enter</kbd> posicionar</span><span><kbd>○ / Esc</kbd> voltar</span></footer>
        </div>
      </section>

      <section className={`screen death-screen ${screen!=="dead"?"hidden":""}`}>
        <div className="result-card"><p className="eyebrow">Fim da expedição</p><h2>Você não resistiu</h2><p>Distância explorada: <strong>{snapshot.distance} metros</strong><br/>Recursos reunidos: <strong>{snapshot.berries+snapshot.rawMeat+snapshot.cookedMeat+snapshot.wood+snapshot.stone}</strong></p><div className="menu-actions"><button className={`primary-btn ${menuActionIndex===0?"controller-selected":""}`} onMouseEnter={()=>setMenuActionIndex(0)} onClick={start}>Tentar novamente <small>✕</small></button><button className={`secondary-btn ${menuActionIndex===1?"controller-selected":""}`} onMouseEnter={()=>setMenuActionIndex(1)} onClick={()=>setScreen("title")}>Voltar ao título <small>○</small></button></div></div>
      </section>
    </main>
  );
}
