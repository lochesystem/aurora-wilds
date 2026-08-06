import assert from "node:assert/strict";
import test from "node:test";
import { findNextSpatialIndex, gamepadMenuDirection } from "../app/game/menuNavigation.js";

test("DualSense navega por direcional e analógico esquerdo",()=>{
  const buttons=Array(16).fill(false);buttons[12]=true;
  assert.equal(gamepadMenuDirection([0,0],buttons),"up");
  assert.equal(gamepadMenuDirection([.8,.15],Array(16).fill(false)),"right");
  assert.equal(gamepadMenuDirection([.2,-.9],Array(16).fill(false)),"up");
  assert.equal(gamepadMenuDirection([.2,.25],Array(16).fill(false)),null);
});

test("a seleção espacial escolhe o botão visualmente mais próximo",()=>{
  const rects=[
    {left:0,top:0,width:100,height:40},
    {left:140,top:5,width:100,height:40},
    {left:0,top:90,width:100,height:40},
    {left:150,top:100,width:100,height:40},
  ];
  assert.equal(findNextSpatialIndex(rects,0,"right"),1);
  assert.equal(findNextSpatialIndex(rects,0,"down"),2);
  assert.equal(findNextSpatialIndex(rects,3,"left"),2);
  assert.equal(findNextSpatialIndex(rects,0,"up"),-1);
});
