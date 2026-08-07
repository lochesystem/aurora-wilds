import assert from "node:assert/strict";
import test from "node:test";
import { finishCombo, requestCombo } from "../app/game/combat-combo.js";

test("três pressões rápidas são armazenadas como uma sequência de três golpes",()=>{
  let state=requestCombo({step:0,buffered:0,active:false,windowOpen:false});
  state=requestCombo({...state,active:true});
  state=requestCombo({...state,active:true});
  assert.equal(state.step,1);assert.equal(state.buffered,2);
  state=finishCombo(state);assert.equal(state.startStep,2);
  state=finishCombo(state);assert.equal(state.startStep,3);
  state=finishCombo(state);assert.equal(state.startStep,0);assert.equal(state.windowOpen,true);
});

test("uma pressão dentro da janela de continuação avança o combo",()=>{
  const next=requestCombo({step:1,buffered:0,active:false,windowOpen:true});
  assert.equal(next.startStep,2);
});
