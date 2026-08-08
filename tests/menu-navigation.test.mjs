import assert from "node:assert/strict";
import test from "node:test";
import { moveGridSelection } from "../app/game/menu-navigation.js";

test("direcionais navegam um grid sem transformar baixo em direita",()=>{
  assert.equal(moveGridSelection(0,5,2,"down"),2);
  assert.equal(moveGridSelection(2,5,2,"right"),3);
  assert.equal(moveGridSelection(3,5,2,"up"),1);
  assert.equal(moveGridSelection(1,5,2,"left"),0);
});

test("a última linha incompleta escolhe o item disponível mais próximo",()=>{
  assert.equal(moveGridSelection(3,5,2,"down"),4);
  assert.equal(moveGridSelection(4,5,2,"right"),4);
  assert.equal(moveGridSelection(0,5,2,"left"),0);
});
