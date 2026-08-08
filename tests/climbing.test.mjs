import assert from "node:assert/strict";
import test from "node:test";
import { canStartClimb, climbingLimbPose, stepClimbStamina } from "../app/game/climbing.js";

test("escalada exige parede, movimento, comando e resistência",()=>{
  assert.equal(canStartClimb({rise:1.2,holding:true,moving:true,stamina:50}),true);
  assert.equal(canStartClimb({rise:.2,holding:true,moving:true,stamina:50}),false);
  assert.equal(canStartClimb({rise:1.2,holding:false,moving:true,stamina:50}),false);
  assert.equal(canStartClimb({rise:1.2,holding:true,moving:true,stamina:0}),false);
});

test("escalar consome resistência e descansar recupera",()=>{
  assert.equal(stepClimbStamina(50,1,true),32);assert.equal(stepClimbStamina(50,1,false),62);
  const a=climbingLimbPose(0),b=climbingLimbPose(Math.PI/5.4);assert.notEqual(a.leftArm,b.leftArm);assert.ok(a.leftArm<-1.8&&a.rightArm<-1.8);
});
