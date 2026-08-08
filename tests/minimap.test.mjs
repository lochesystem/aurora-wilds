import assert from "node:assert/strict";
import test from "node:test";
import { minimapHeading, minimapPosition } from "../app/game/minimap.js";

test("leste fica à direita e oeste fica à esquerda no minimapa",()=>{
  assert.ok(minimapPosition(10,0).left>50);
  assert.ok(minimapPosition(-10,0).left<50);
});

test("a ponta da seta acompanha esquerda e direita do personagem",()=>{
  assert.equal(minimapHeading(Math.PI/2),Math.PI*.5);
  assert.equal(minimapHeading(-Math.PI/2),Math.PI*1.5);
});
