export const CRAFTING_RECIPES = [
  { id:"axe", name:"Machado de pedra", description:"Retira mais madeira de cada árvore.", cost:{ wood:3, stone:2 } },
  { id:"pickaxe", name:"Picareta de pedra", description:"Extrai mais pedra de cada rocha.", cost:{ wood:2, stone:3 } },
  { id:"hammer", name:"Martelo de construção", description:"Abre o catálogo e posiciona peças do acampamento.", cost:{ wood:3, stone:1 } },
  { id:"spear", name:"Lança de pedra", description:"Arma de alcance para combate e caça.", cost:{ wood:4, stone:2 } },
  { id:"campfire", name:"Fogueira", description:"Aquece, ilumina e protege contra o frio noturno.", cost:{ wood:4, stone:4 } },
];

export function getRecipe(recipeId){
  return CRAFTING_RECIPES.find(recipe=>recipe.id===recipeId)??null;
}

export function canCraft(recipe,inventory){
  return inventory.wood>=recipe.cost.wood&&inventory.stone>=recipe.cost.stone;
}

export function craftRecipe(recipe,inventory){
  if(!canCraft(recipe,inventory))return null;
  return {...inventory,wood:inventory.wood-recipe.cost.wood,stone:inventory.stone-recipe.cost.stone};
}
