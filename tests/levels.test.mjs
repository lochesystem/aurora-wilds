import assert from "node:assert/strict";
import test from "node:test";
import { CAMPAIGN_LEVELS, generateLevel, validateCoinPlacements, validateEnemyPlacements, validateLevel, validatePlatformClearance } from "../app/game/levels.js";

test("a campanha contém 25 fases determinísticas e completáveis",()=>{
  assert.equal(CAMPAIGN_LEVELS.length,25);
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);
    assert.deepEqual(level,generateLevel(number));
    assert.deepEqual(validateLevel(level),[],`fase ${number}: ${validateLevel(level).join(", ")}`);
    assert.equal(level.number,number);
    assert.ok(level.coins.length>=Math.ceil(level.platforms.length/2));
    assert.ok(level.enemies.length>=2);
  }
});

test("dificuldade acrescenta plataformas, canos, inimigos e atiradores",()=>{
  const first=generateLevel(1),middle=generateLevel(13),last=generateLevel(25);
  assert.ok(last.platforms.length>first.platforms.length);
  assert.ok(last.pipes.length>first.pipes.length);
  assert.ok(last.enemies.length>first.enemies.length);
  assert.equal(first.enemies.some(enemy=>enemy.shooter),false);
  assert.equal(middle.enemies.some(enemy=>enemy.shooter),true);
  assert.equal(last.enemies.some(enemy=>enemy.shooter),true);
});

test("cada fase tem identidade mecânica e geometria próprias",()=>{
  const levels=Array.from({length:25},(_,index)=>generateLevel(index+1));
  const geometrySignatures=new Set(levels.map(level=>JSON.stringify(level.platforms.map(platform=>[...platform.p,...platform.s,platform.kind]))));
  assert.equal(geometrySignatures.size,25);
  assert.equal(new Set(levels.map(level=>level.gimmick)).size,25);
  assert.ok(levels.some(level=>level.hazards.length>0));
  assert.ok(levels.some(level=>level.jumpPads.length>0));
  assert.ok(levels.some(level=>level.platforms.some(platform=>platform.kind==="beam")));
});

test("a campanha não se limita a escadas lineares",()=>{
  const ring=generateLevel(3),hub=generateLevel(4),basin=generateLevel(8),finale=generateLevel(25);
  assert.ok(Math.min(...ring.platforms.map(platform=>platform.p[0]))<0);
  assert.ok(Math.max(...ring.platforms.map(platform=>platform.p[0]))>0);
  assert.ok(ring.goal[2]>Math.min(...ring.platforms.map(platform=>platform.p[2])),"o circuito deve retornar ao centro");
  assert.ok(Math.min(...hub.platforms.map(platform=>platform.p[0]))<-8&&Math.max(...hub.platforms.map(platform=>platform.p[0]))>8,"o hub precisa ter ramificações laterais");
  assert.ok(Math.min(...basin.platforms.map(platform=>platform.p[1]))<0,"a fase de bacia precisa descer antes de subir");
  assert.ok(finale.platforms.length>=14,"a fase final deve ser uma prova ampla, não uma escada curta");
});

test("cada fase é longa, vertical e mistura estruturas",()=>{
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);const kinds=new Set(level.platforms.map(platform=>platform.kind));
    assert.ok(level.platforms.length>=14,`fase ${number} curta demais`);
    assert.ok(level.goal[1]>20,`fase ${number} sem verticalidade suficiente`);
    assert.ok(Math.max(...level.platforms.map(platform=>platform.p[2]))-Math.min(...level.platforms.map(platform=>platform.p[2]))>28,`fase ${number} compacta demais`);
    assert.ok(kinds.size>=4,`fase ${number} repete poucas estruturas`);
    assert.ok(level.platforms.filter(platform=>platform.kind==="island"||platform.kind==="small").length<level.platforms.length*.6,`fase ${number} ainda depende demais de ilhas`);
  }
});

test("as rotas têm vãos maiores, peças finas e rampas inclinadas",()=>{
  const levels=Array.from({length:25},(_,index)=>generateLevel(index+1));
  const tilted=levels.flatMap(level=>level.platforms).filter(platform=>platform.r?.some(value=>Math.abs(value)>.001));
  const thin=levels.flatMap(level=>level.platforms).filter(platform=>platform.s[1]<.65||Math.min(platform.s[0],platform.s[2])<2);
  const medianGaps=levels.map(level=>level.platforms.slice(1).map((platform,index)=>{const previous=level.platforms[index];return Math.hypot(platform.p[0]-previous.p[0],platform.p[2]-previous.p[2])-(Math.min(platform.s[0],platform.s[2])+Math.min(previous.s[0],previous.s[2]))/2}).sort((a,b)=>a-b)[Math.floor((level.platforms.length-1)/2)]);
  assert.ok(tilted.length>=35,"faltam rampas inclinadas na campanha");
  assert.ok(thin.length>=80,"faltam apoios finos e de precisão");
  assert.ok(medianGaps.filter(gap=>gap>1.35).length>=20,"as rotas ainda estão compactas demais");
});

test("todas as moedas ficam acima de um bloco e com espaço livre",()=>{
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);
    assert.deepEqual(validateCoinPlacements(level),[],`fase ${number}: ${validateCoinPlacements(level).join(", ")}`);
  }
});

test("nenhum inimigo patrulha sob blocos ou em apoios estreitos",()=>{
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);
    assert.deepEqual(validateEnemyPlacements(level),[],`fase ${number}: ${validateEnemyPlacements(level).join(", ")}`);
    assert.deepEqual(validatePlatformClearance(level),[],`fase ${number}: ${validatePlatformClearance(level).join(", ")}`);
  }
});

test("a plataforma inicial é uma zona segura sem inimigos",()=>{
  for(let number=1;number<=25;number++){
    const level=generateLevel(number);const start=level.platforms[0];const top=start.p[1]+.395+start.s[1]/2;
    const enemiesAtStart=level.enemies.filter(enemy=>Math.abs(enemy.p[1]-(top+.085))<.05&&Math.abs(enemy.p[0]-start.p[0])<=start.s[0]/2&&Math.abs(enemy.p[2]-start.p[2])<=start.s[2]/2);
    assert.deepEqual(enemiesAtStart,[],`fase ${number} tem inimigo na área inicial`);
  }
});

test("a dificuldade geométrica cresce ao longo da campanha",()=>{
  const metric=number=>{const level=generateLevel(number);const gaps=level.platforms.slice(1).map((platform,index)=>{const previous=level.platforms[index];return Math.hypot(platform.p[0]-previous.p[0],platform.p[2]-previous.p[2])-(Math.min(platform.s[0],platform.s[2])+Math.min(previous.s[0],previous.s[2]))/2});const widths=level.platforms.slice(1).map(platform=>Math.min(platform.s[0],platform.s[2]));return {gap:gaps.reduce((sum,value)=>sum+value,0)/gaps.length,width:widths.reduce((sum,value)=>sum+value,0)/widths.length,tilt:Math.max(...level.platforms.flatMap(platform=>platform.r.map(Math.abs))),enemies:level.enemies.length,challenge:level.challenge}};
  const average=(numbers,key)=>numbers.map(number=>metric(number)[key]).reduce((sum,value)=>sum+value,0)/numbers.length;
  const early=[1,2,3,4,5],late=[21,22,23,24,25];
  assert.ok(average(late,"gap")>average(early,"gap")+.55,"os saltos finais precisam ser mais longos");
  assert.ok(average(late,"width")<average(early,"width")-.25,"os apoios finais precisam ser mais finos");
  assert.ok(average(late,"tilt")>average(early,"tilt")+.04,"as inclinações finais precisam ser maiores");
  assert.ok(average(late,"enemies")>average(early,"enemies"),"as fases finais precisam ter mais guardiões");
  for(let number=2;number<=25;number++)assert.ok(metric(number).challenge>metric(number-1).challenge);
});
