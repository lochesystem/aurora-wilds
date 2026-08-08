import assert from "node:assert/strict";
import test from "node:test";
import { DAY_SECONDS, NIGHT_SECONDS, WORLD_CYCLE_SECONDS, nextDawnAt, worldTimeAt } from "../app/game/world-time.js";

test("the first day gives eight minutes to prepare",()=>{
  assert.equal(DAY_SECONDS,480);
  assert.deepEqual(worldTimeAt(0),{fraction:7/24,isNight:false,timeLabel:"07:00"});
  assert.equal(worldTimeAt(DAY_SECONDS-1).isNight,false);
  assert.equal(worldTimeAt(DAY_SECONDS).isNight,true);
  assert.equal(worldTimeAt(DAY_SECONDS).timeLabel,"18:00");
});

test("night lasts four minutes and the clock loops to morning",()=>{
  assert.equal(NIGHT_SECONDS,240);
  assert.equal(WORLD_CYCLE_SECONDS,720);
  assert.equal(worldTimeAt(DAY_SECONDS+NIGHT_SECONDS/2).isNight,true);
  assert.deepEqual(worldTimeAt(WORLD_CYCLE_SECONDS),worldTimeAt(0));
});

test("saved elapsed time is normalized for negative and long values",()=>{
  assert.deepEqual(worldTimeAt(-1),worldTimeAt(WORLD_CYCLE_SECONDS-1));
  assert.deepEqual(worldTimeAt(WORLD_CYCLE_SECONDS*4+32),worldTimeAt(32));
});

test("dormir durante a noite avança exatamente para o próximo amanhecer",()=>{
  assert.equal(nextDawnAt(DAY_SECONDS+35),WORLD_CYCLE_SECONDS);
  assert.equal(worldTimeAt(nextDawnAt(WORLD_CYCLE_SECONDS+DAY_SECONDS+120)).timeLabel,"07:00");
  assert.equal(nextDawnAt(60),60);
});
