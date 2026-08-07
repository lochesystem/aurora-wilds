import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renderiza a identidade final do jogo", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<title>Aurora Wilds — Sobrevivência procedural 3D<\/title>/i);
  assert.match(html, /mundo procedural sem bordas/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  assert.match(html, /og\.png/);
});

test("mantém os sistemas essenciais do survival no bundle-fonte", async () => {
  const [shell, engine, world, building, harvesting, saveGame, settings, packageJson] = await Promise.all([
    readFile(new URL("../app/game/GameShell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/game/engine.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/game/survival-world.js", import.meta.url), "utf8"),
    readFile(new URL("../app/game/building.js", import.meta.url), "utf8"),
    readFile(new URL("../app/game/harvesting.js", import.meta.url), "utf8"),
    readFile(new URL("../app/game/save-game.js", import.meta.url), "utf8"),
    readFile(new URL("../app/game/settings.ts", import.meta.url), "utf8"),
    readFile(new URL("../package.json", import.meta.url), "utf8"),
  ]);
  assert.match(engine, /computeColliderMovement/);
  assert.match(engine, /syncChunks/);
  assert.match(engine, /collect\(resource/);
  assert.match(engine, /eatBerry/);
  assert.match(engine, /this\.hunger/);
  assert.match(engine, /vibrationActuator/);
  assert.match(world, /terrainHeightAt/);
  assert.match(world, /resourcesForChunk/);
  assert.match(world, /visibleChunkCoordinates/);
  assert.match(shell, /Entrar no mundo/);
  assert.match(shell, /Frutos/);
  assert.match(shell, /Inventário & crafting/);
  assert.match(shell, /Prepare-se antes do anoitecer/);
  assert.match(engine, /placeCampfire/);
  assert.match(engine, /temperature<5/);
  assert.match(engine, /startBuilding/);
  assert.match(engine, /interactChest/);
  assert.match(engine, /respawnPosition/);
  assert.match(engine, /attackResource/);
  assert.match(engine, /setPlayerEquipment/);
  assert.match(engine, /AnimationMixer/);
  assert.match(shell, /Construir acampamento/);
  assert.match(building, /foundation/);
  assert.match(building, /chest/);
  assert.match(harvesting, /harvestHit/);
  assert.match(saveGame, /aurora-wilds-save-v1/);
  assert.match(settings, /localStorage/);
  assert.match(settings, /grassAmount/);
  assert.match(shell, /Nenhuma/);
  assert.match(shell, /Pouca/);
  assert.match(shell, /Muita/);
  assert.match(packageJson, /@dimforge\/rapier3d-compat/);
  assert.match(packageJson, /"three"/);
  await access(new URL("../public/og.png", import.meta.url));
  await assert.rejects(access(new URL("../app/_sites-preview/SkeletonPreview.tsx", import.meta.url)));
});
