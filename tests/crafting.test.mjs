import assert from "node:assert/strict";
import test from "node:test";
import { CRAFTING_RECIPES, canCraft, craftRecipe, getRecipe } from "../app/game/crafting.js";

test("as receitas essenciais da primeira noite são estáveis",()=>{
  assert.deepEqual(CRAFTING_RECIPES.map(recipe=>recipe.id),["axe","pickaxe","hammer","spear","campfire"]);
  assert.equal(getRecipe("campfire")?.cost.wood,4);
});

test("crafting só consome materiais quando a receita é possível",()=>{
  const axe=getRecipe("axe");
  assert.equal(canCraft(axe,{wood:2,stone:5}),false);
  assert.equal(craftRecipe(axe,{wood:2,stone:5}),null);
  assert.deepEqual(craftRecipe(axe,{wood:5,stone:4}),{wood:2,stone:2});
});
