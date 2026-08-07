import assert from "node:assert/strict";
import test from "node:test";
import { locomotionPose } from "../app/game/locomotion.js";

test("os joelhos sempre flexionam para trás sem hiperextensão",()=>{
  for(const running of [false,true])for(let time=0;time<8;time+=.05){
    const pose=locomotionPose(time,7,running);
    assert.ok(pose.leftKnee>=.08);
    assert.ok(pose.rightKnee>=.08);
  }
});

test("a corrida usa cadência, passada e postura próprias",()=>{
  const walk=locomotionPose(.6,7,false);
  const run=locomotionPose(.6,7,true);
  assert.ok(run.cadence>walk.cadence);
  assert.ok(Math.abs(run.leftHip)>Math.abs(walk.leftHip));
  assert.ok(run.bodyLean>walk.bodyLean);
  assert.ok(run.bodyBob>walk.bodyBob);
});
