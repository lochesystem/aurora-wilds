"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuroraGame, WORLD_SEED, type GameSnapshot } from "./engine";
import { loadSettings, saveSettings, type GrassAmount } from "./settings";
import { CRAFTING_RECIPES } from "./crafting.js";
import { BUILDING_PIECES } from "./building.js";
import { DEFAULT_HOTBAR } from "./inventory.js";

type Screen = "title" | "playing" | "inventory" | "build" | "paused" | "settings" | "dead";

const GRASS_OPTIONS:Array<{value:GrassAmount;label:string;description:string}>=[
  {value:"none",label:"Nenhuma",description:"Remove toda a grama para máximo desempenho."},
  {value:"low",label:"Pouca",description:"Vegetação leve com clareiras e transições orgânicas."},
  {value:"high",label:"Muita",description:"Campos densos com cobertura completa nas áreas férteis."},
];

const EMPTY: GameSnapshot = {
  health:100, hunger:78, berries:0, rawMeat:0, cookedMeat:0, wood:0, stone:0,
  distance:0, chunks:25, biome:"Campos de Aurora", interaction:"", selectedSlot:0,hotbarSlots:[...DEFAULT_HOTBAR],
  axeDurability:0,pickaxeDurability:0,spearDurability:0,campfireKits:0,timeLabel:"07:00",isNight:false,temperature:18,nearFire:false,survivedNights:0,hammer:false,buildingPiece:"",buildingValid:false,buildingSnap:"",buildingIssue:"",sheltered:false,comboStep:0,comboBuffered:0,gamepad:"",
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
  const [settings,setSettings]=useState(loadSettings);

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
  useEffect(()=>()=>{if(toastTimer.current)clearTimeout(toastTimer.current);},[]);

  const start=useCallback(()=>{
    setRunId(current=>current+1);
    setScreen("playing");
    setSnapshot(EMPTY);
    showToast("Explore, colete e sobreviva");
    canvasRef.current?.focus();
  },[showToast]);

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
      if(screen==="inventory"&&justPressed(2))assignInventoryItem(INVENTORY_ITEMS[selectedInventoryIndex].id);
      else if(screen==="inventory"&&justPressed(4))setHotbarEditSlot(current=>(current+8)%9);
      else if(screen==="inventory"&&justPressed(5))setHotbarEditSlot(current=>(current+1)%9);
      else if(justPressed(0)){
        if(screen==="inventory")gameRef.current?.craft(CRAFTING_RECIPES[selectedRecipe].id);
        else if(screen==="build"){gameRef.current?.startBuilding(BUILDING_PIECES[selectedBuildingPiece].id);resume();}
        else if(screen==="paused")resume();else start();
      }else if(screen==="inventory"&&justPressed(14))setSelectedInventoryIndex(current=>(current+INVENTORY_ITEMS.length-1)%INVENTORY_ITEMS.length);
      else if(screen==="inventory"&&justPressed(15))setSelectedInventoryIndex(current=>(current+1)%INVENTORY_ITEMS.length);
      else if(screen==="inventory"&&justPressed(12))setSelectedRecipe(current=>(current+CRAFTING_RECIPES.length-1)%CRAFTING_RECIPES.length);
      else if(screen==="inventory"&&justPressed(13))setSelectedRecipe(current=>(current+1)%CRAFTING_RECIPES.length);
      else if(screen==="build"&&(justPressed(12)||justPressed(14)))setSelectedBuildingPiece(current=>(current+BUILDING_PIECES.length-1)%BUILDING_PIECES.length);
      else if(screen==="build"&&(justPressed(13)||justPressed(15)))setSelectedBuildingPiece(current=>(current+1)%BUILDING_PIECES.length);
      else if(screen==="settings"&&(justPressed(12)||justPressed(14)))cycleGrass(-1);
      else if(screen==="settings"&&(justPressed(13)||justPressed(15)))cycleGrass(1);
      else if((justPressed(9)||justPressed(17))&&screen==="inventory")resume();
      else if((justPressed(1)||justPressed(17))&&screen==="build")resume();
      else if(justPressed(9)&&screen==="paused")resume();
      else if(justPressed(1)&&screen==="inventory")resume();
      else if(justPressed(1)&&screen==="settings")setScreen("paused");
      else if(justPressed(1)&&(screen==="paused"||screen==="dead"))setScreen("title");
      menuPadButtons.current=next;
      frame=requestAnimationFrame(tick);
    };
    frame=requestAnimationFrame(tick);
    return()=>cancelAnimationFrame(frame);
  },[screen,start,resume,selectedRecipe,selectedBuildingPiece,selectedInventoryIndex,assignInventoryItem,cycleGrass]);

  useEffect(()=>{
    if(screen!=="inventory")return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()==="i"||event.key==="Escape"){resume();return;}
      if(event.key==="ArrowUp")setSelectedRecipe(current=>(current+CRAFTING_RECIPES.length-1)%CRAFTING_RECIPES.length);
      if(event.key==="ArrowDown")setSelectedRecipe(current=>(current+1)%CRAFTING_RECIPES.length);
      if(event.key==="ArrowLeft")setSelectedInventoryIndex(current=>(current+INVENTORY_ITEMS.length-1)%INVENTORY_ITEMS.length);
      if(event.key==="ArrowRight")setSelectedInventoryIndex(current=>(current+1)%INVENTORY_ITEMS.length);
      if(event.key===" "){event.preventDefault();assignInventoryItem(INVENTORY_ITEMS[selectedInventoryIndex].id);}
      if(event.key==="Enter")gameRef.current?.craft(CRAFTING_RECIPES[selectedRecipe].id);
    };
    window.addEventListener("keydown",onKeyDown);return()=>window.removeEventListener("keydown",onKeyDown);
  },[screen,resume,selectedRecipe,selectedInventoryIndex,assignInventoryItem]);

  useEffect(()=>{
    if(screen!=="build")return;
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key.toLowerCase()==="i"||event.key==="Escape"){resume();return;}
      if(event.key==="ArrowUp")setSelectedBuildingPiece(current=>(current+BUILDING_PIECES.length-1)%BUILDING_PIECES.length);
      if(event.key==="ArrowDown")setSelectedBuildingPiece(current=>(current+1)%BUILDING_PIECES.length);
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

        <div className={`survival-objective ${snapshot.survivedNights>0?"complete":snapshot.isNight?"urgent":""}`}><span>{snapshot.survivedNights>0?"Objetivo concluído":snapshot.isNight?"Sobreviva ao frio":"Prepare-se antes do anoitecer"}</span><strong>{snapshot.survivedNights>0?"Primeiro amanhecer alcançado":snapshot.nearFire?"Permaneça perto da fogueira":"Fabrique ferramentas e uma fogueira"}</strong></div>

        <div className="survival-vitals" aria-label="Estado do personagem">
          <div className="vital-line health-line"><span>♥</span><i className={healthColor}><em style={{width:`${snapshot.health}%`}} /></i><b>{snapshot.health}</b></div>
          <div className="vital-line hunger-line"><span>◆</span><i className={hungerColor}><em style={{width:`${snapshot.hunger}%`}} /></i><b>{snapshot.hunger}</b></div>
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
          {snapshot.buildingPiece?(snapshot.gamepad?<><span className="controller-name">Modo construção</span><span><kbd>△</kbd> construir</span><span><kbd>L2/R2</kbd> girar</span><span><kbd>○</kbd> cancelar</span></>:<><span><kbd>Q</kbd> construir</span><span><kbd>R</kbd> girar</span><span><kbd>Esc</kbd> cancelar</span></>):snapshot.gamepad?<><span className="controller-name">{snapshot.gamepad}</span><span><kbd>L1/R1</kbd> slots</span><span><kbd>□</kbd> coletar</span><span><kbd>△</kbd> atacar / usar</span><span><kbd>Touchpad</kbd> inventário</span><span><kbd>✕</kbd> saltar</span></>:<><span><kbd>WASD</kbd> mover</span><span><kbd>Scroll / 1–9</kbd> selecionar</span><span><kbd>I</kbd> inventário</span><span><kbd>E</kbd> coletar</span><span><kbd>Q</kbd> atacar / usar</span></>}
        </div>
      </div>

      <div className={`toast ${toast?"show":""}`}>{toast}</div>
      <div className={`damage-flash ${damageFlash?"show":""}`} onAnimationEnd={()=>setDamageFlash(false)} />

      <section className={`screen survival-title ${screen!=="title"?"hidden":""}`}>
        <div className="survival-enter-wrap">
          <button className="primary-btn survival-enter-btn" onClick={start}>Entrar no mundo <small>✕</small></button>
        </div>
      </section>

      <section className={`screen ${screen!=="paused"?"hidden":""}`}>
        <div className="pause-card"><p className="eyebrow">Expedição interrompida</p><h2>Pausado</h2><p>O mundo espera. Fome e simulação estão congeladas.</p><div className="menu-actions"><button className="primary-btn" onClick={resume}>Continuar <small>✕</small></button><button className="secondary-btn" onClick={()=>setScreen("settings")}>Configurações</button><button className="secondary-btn" onClick={()=>setScreen("title")}>Sair ao título <small>○</small></button></div></div>
      </section>

      <section className={`screen ${screen!=="settings"?"hidden":""}`}>
        <div className="pause-card grass-settings-card"><p className="eyebrow">Desempenho e visual</p><h2>Vegetação</h2><p>Escolha quanta grama será desenhada no mundo.</p><div className="grass-options" role="radiogroup" aria-label="Quantidade de grama">{GRASS_OPTIONS.map(option=><button key={option.value} type="button" role="radio" aria-checked={settings.grassAmount===option.value} className={settings.grassAmount===option.value?"selected":""} onClick={()=>changeGrass(option.value)}><strong>{option.label}</strong><small>{option.description}</small></button>)}</div><div className="settings-hint"><span><kbd>← →</kbd> escolher</span><span><kbd>○ / Esc</kbd> voltar</span></div><button className="primary-btn" onClick={()=>setScreen("paused")}>Voltar</button></div>
      </section>

      <section className={`screen inventory-screen ${screen!=="inventory"?"hidden":""}`}>
        <div className="inventory-modal">
          <header><div><p className="eyebrow">Bancada de campo</p><h2>Inventário & crafting</h2></div><button className="icon-btn" onClick={resume} aria-label="Fechar inventário">×</button></header>
          <div className="inventory-summary"><span><b>{snapshot.wood}</b> madeira</span><span><b>{snapshot.stone}</b> pedra</span><span><b>{snapshot.berries}</b> frutos</span><span><b>{snapshot.rawMeat}</b> carne crua</span><span><b>{snapshot.cookedMeat}</b> carne assada</span></div>
          <div className="inventory-loadout">
            <div className="inventory-section-heading"><div><strong>Mochila</strong><small>Arraste ou selecione um item</small></div><span>{INVENTORY_ITEMS.filter(item=>itemOwned(item.id,snapshot)).length}/{INVENTORY_ITEMS.length} tipos</span></div>
            <div className="inventory-item-grid" role="list" aria-label="Itens do jogador">
              {INVENTORY_ITEMS.map((item,index)=>{const count=itemCount(item.id,snapshot),durability=itemDurability(item.id,snapshot),owned=itemOwned(item.id,snapshot);return <button key={item.id} type="button" role="listitem" draggable={owned} className={`inventory-item ${selectedInventoryIndex===index?"selected":""} ${owned?"owned":"unavailable"}`} onClick={()=>setSelectedInventoryIndex(index)} onDoubleClick={()=>owned&&assignInventoryItem(item.id)} onDragStart={event=>{event.dataTransfer.setData("text/plain",item.id);event.dataTransfer.effectAllowed="move";setSelectedInventoryIndex(index);}} aria-label={`${item.name}${owned?"":" indisponível"}`}>
                <span className="inventory-item-icon"><ItemIcon itemId={item.id} snapshot={snapshot}/></span><strong>{item.name}</strong><small>{item.description}</small>{count!==null&&<b>{count}</b>}{durability!==null&&<i><em style={{width:`${durability}%`}}/></i>}
              </button>;})}
            </div>
            <div className="inventory-section-heading hotbar-heading"><div><strong>Atalhos</strong><small>Solte o item no slot desejado</small></div><span><kbd>L1/R1</kbd> slot · <kbd>□</kbd> equipar</span></div>
            <div className="inventory-hotbar" aria-label="Configuração da barra de atalhos">
              {snapshot.hotbarSlots.map((itemId,index)=>{const item=ITEM_BY_ID.get(itemId),count=itemCount(itemId,snapshot);return <button key={index} type="button" draggable={Boolean(itemId)} className={`inventory-hotbar-slot ${hotbarEditSlot===index?"selected":""}`} onClick={()=>{setHotbarEditSlot(index);const selected=INVENTORY_ITEMS[selectedInventoryIndex];if(itemOwned(selected.id,snapshot))assignInventoryItem(selected.id,index);}} onDragStart={event=>{if(itemId){event.dataTransfer.setData("text/plain",itemId);event.dataTransfer.effectAllowed="move";}}} onDragOver={event=>{event.preventDefault();event.dataTransfer.dropEffect="move";}} onDrop={event=>{event.preventDefault();const dropped=event.dataTransfer.getData("text/plain");if(ITEM_BY_ID.has(dropped))assignInventoryItem(dropped,index);}} aria-label={`Atalho ${index+1}: ${item?.name??"vazio"}`}>
                <span>{index+1}</span><ItemIcon itemId={itemId} snapshot={snapshot}/>{count!==null&&count>0&&<b>{count}</b>}
              </button>;})}
            </div>
          </div>
          <div className="crafting-heading"><strong>Fabricação</strong><small>Use os recursos da mochila para criar equipamentos</small></div>
          <div className="recipe-list">
            {CRAFTING_RECIPES.map((recipe,index)=>{const affordable=snapshot.wood>=recipe.cost.wood&&snapshot.stone>=recipe.cost.stone;return <button key={recipe.id} className={`recipe-card ${selectedRecipe===index?"selected":""} ${affordable?"affordable":"locked"}`} onMouseEnter={()=>setSelectedRecipe(index)} onClick={()=>gameRef.current?.craft(recipe.id)}>
              <span className={`recipe-icon ${recipe.id}`}>{recipe.id==="campfire"?"♨":recipe.id==="spear"?"↟":"⌁"}</span><div><strong>{recipe.name}</strong><small>{recipe.description}</small><em><i className={snapshot.wood>=recipe.cost.wood?"ready":""}>▰ {recipe.cost.wood}</i><i className={snapshot.stone>=recipe.cost.stone?"ready":""}>◆ {recipe.cost.stone}</i></em></div><kbd>{selectedRecipe===index?"✕":""}</kbd>
            </button>;})}
          </div>
          <footer><span><kbd>←→</kbd> item</span><span><kbd>□ / Espaço</kbd> equipar</span><span><kbd>↑↓</kbd> receita</span><span><kbd>✕ / Enter</kbd> fabricar</span><span><kbd>○ / I</kbd> voltar</span></footer>
        </div>
      </section>

      <section className={`screen inventory-screen ${screen!=="build"?"hidden":""}`}>
        <div className="inventory-modal building-modal">
          <header><div><p className="eyebrow">Martelo equipado</p><h2>Construir acampamento</h2></div><button className="icon-btn" onClick={resume} aria-label="Fechar menu de construção">×</button></header>
          <div className="inventory-summary"><span><b>{snapshot.wood}</b> madeira</span><span><b>{snapshot.stone}</b> pedra</span><span><b>Local</b> save automático</span></div>
          <div className="recipe-list building-list">
            {BUILDING_PIECES.map((piece,index)=>{const affordable=snapshot.wood>=piece.cost.wood&&snapshot.stone>=piece.cost.stone;return <button key={piece.id} className={`recipe-card building-card ${selectedBuildingPiece===index?"selected":""} ${affordable?"affordable":"locked"}`} onMouseEnter={()=>setSelectedBuildingPiece(index)} onClick={()=>{gameRef.current?.startBuilding(piece.id);resume();}}>
              <span className={`recipe-icon building-icon ${piece.id}`}>{piece.id==="foundation"?"▦":piece.id==="wall"?"▥":piece.id==="door"?"Π":piece.id==="roof"?"⌂":piece.id==="chest"?"▣":"▱"}</span><div><strong>{piece.name}</strong><small>{piece.description}</small><em><i className={snapshot.wood>=piece.cost.wood?"ready":""}>▰ {piece.cost.wood}</i><i className={snapshot.stone>=piece.cost.stone?"ready":""}>◆ {piece.cost.stone}</i></em></div><kbd>{selectedBuildingPiece===index?"✕":""}</kbd>
            </button>;})}
          </div>
          <footer><span><kbd>↑↓</kbd> escolher</span><span><kbd>✕ / Enter</kbd> posicionar</span><span><kbd>○ / Esc</kbd> voltar</span></footer>
        </div>
      </section>

      <section className={`screen death-screen ${screen!=="dead"?"hidden":""}`}>
        <div className="result-card"><p className="eyebrow">Fim da expedição</p><h2>Você não resistiu</h2><p>Distância explorada: <strong>{snapshot.distance} metros</strong><br/>Recursos reunidos: <strong>{snapshot.berries+snapshot.rawMeat+snapshot.cookedMeat+snapshot.wood+snapshot.stone}</strong></p><div className="menu-actions"><button className="primary-btn" onClick={start}>Tentar novamente <small>✕</small></button><button className="secondary-btn" onClick={()=>setScreen("title")}>Voltar ao título <small>○</small></button></div></div>
      </section>
    </main>
  );
}
