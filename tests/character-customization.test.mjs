import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_CHARACTER, HAIR_STYLES, normalizeCharacter } from "../app/game/character-customization.js";

test("o criador oferece cinco modelos de cabelo",()=>assert.equal(HAIR_STYLES.length,5));
test("aparência inválida volta para valores seguros",()=>{
  assert.deepEqual(normalizeCharacter({hairStyle:99,skinColor:"red",hairColor:"#123456"}),{hairStyle:4,skinColor:DEFAULT_CHARACTER.skinColor,hairColor:"#123456"});
});
