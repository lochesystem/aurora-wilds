import assert from "node:assert/strict";
import test from "node:test";
import { classifyEnemyContact, coinWithinPickup, segmentSphereHitFraction } from "../app/game/collision.js";

test("coleta moedas por proximidade horizontal e vertical", () => {
  assert.equal(coinWithinPickup({x:0,y:2,z:0},{x:1.15,y:2.7,z:0}),true);
  assert.equal(coinWithinPickup({x:0,y:2,z:0},{x:1.4,y:2,z:0}),false);
  assert.equal(coinWithinPickup({x:0,y:2,z:0},{x:.2,y:3.5,z:0}),false);
});

test("pouso sobre inimigo vira stomp mesmo perto do ápice", () => {
  assert.equal(classifyEnemyContact({horizontalDistance:.5,playerFeetY:3.75,enemyTopY:3.8,verticalVelocity:.8}),"stomp");
  assert.equal(classifyEnemyContact({horizontalDistance:.5,playerFeetY:4.05,enemyTopY:3.8,verticalVelocity:-5}),"stomp");
});

test("contato lateral causa dano e passagem distante não colide", () => {
  assert.equal(classifyEnemyContact({horizontalDistance:.7,playerFeetY:2.8,enemyTopY:3.8,verticalVelocity:0}),"hurt");
  assert.equal(classifyEnemyContact({horizontalDistance:1.2,playerFeetY:3.8,enemyTopY:3.8,verticalVelocity:-5}),"none");
});

test("projétil detecta um alvo atravessado entre dois frames", () => {
  const hit = segmentSphereHitFraction(
    {x:0,y:1,z:0},
    {x:10,y:1,z:0},
    {x:5,y:1,z:0},
    .72,
  );
  assert.ok(hit !== null && hit > .4 && hit < .5);
  assert.equal(segmentSphereHitFraction(
    {x:0,y:1,z:0},
    {x:10,y:1,z:0},
    {x:5,y:3,z:0},
    .72,
  ), null);
});
