import assert from "node:assert/strict";
import test from "node:test";
import { attackDuration, attackEquipmentForStep, attackImpact, attackPose, attackStyleFor } from "../app/game/attack-pose.js";

const STYLES = ["chop", "swing", "smash", "thrust", "jab"];
const STEPS = [1, 2, 3];

test("cada ferramenta tem o seu próprio golpe", () => {
  assert.equal(attackStyleFor("axe"), "chop");
  assert.equal(attackStyleFor("pickaxe"), "swing");
  assert.equal(attackStyleFor("hammer"), "smash");
  assert.equal(attackStyleFor("spear"), "thrust");
  assert.equal(attackStyleFor("hands"), "jab");
  assert.equal(attackStyleFor("desconhecido"), "jab");
});

test("a ferramenta fica travada até o fim do combo",()=>{
  assert.equal(attackEquipmentForStep("axe","hands",1),"axe");
  assert.equal(attackEquipmentForStep("spear","axe",2),"axe");
  assert.equal(attackEquipmentForStep("hands","axe",3),"axe");
});

test("ferramentas usam as duas mãos e socos continuam livres",()=>{
  for(const style of ["chop","swing","smash","thrust"])assert.equal(attackPose({style,step:1,progress:.5}).twoHanded,true);
  assert.equal(attackPose({style:"jab",step:1,progress:.5}).twoHanded,false);
});

test("o peso abre e fecha em zero para não estalar na volta à caminhada", () => {
  for (const style of STYLES) for (const step of STEPS) {
    assert.equal(attackPose({ style, step, progress: 0 }).weight, 0);
    assert.equal(attackPose({ style, step, progress: 1 }).weight, 0);
    assert.equal(attackPose({ style, step, progress: .5 }).weight, 1);
  }
});

test("o peso cresce e decresce sem saltos", () => {
  for (const style of STYLES) {
    let previous = attackPose({ style, step: 1, progress: 0 }).weight;
    for (let progress = .01; progress <= 1.0001; progress += .01) {
      const weight = attackPose({ style, step: 1, progress }).weight;
      assert.ok(Math.abs(weight - previous) < .2, `salto de peso em ${style} @ ${progress.toFixed(2)}`);
      previous = weight;
    }
  }
});

const UPPER_ARM = .4;
const FOREARM = .43;

/**
 * Cinemática direta do braço no plano sagital. O braço pende para baixo em
 * repouso e o cotovelo herda a rotação do ombro, então basta somar os ângulos.
 */
function handReach(pose, side) {
  const shoulder = pose[`${side}ArmX`];
  const elbow = shoulder + pose[`${side}Elbow`];
  return {
    forward: -UPPER_ARM * Math.sin(shoulder) - FOREARM * Math.sin(elbow),
    height: -UPPER_ARM * Math.cos(shoulder) - FOREARM * Math.cos(elbow),
  };
}

// A amplitude é cobrada por família logo abaixo: arco desce, estocada estica.
test("todo golpe estende o cotovelo e termina com a mão à frente do corpo", () => {
  for (const style of STYLES) for (const step of STEPS) {
    const impact = attackImpact(style);
    const windup = attackPose({ style, step, progress: impact * .55 });
    const strike = attackPose({ style, step, progress: impact });
    const side = strike.lead > 0 ? "right" : "left";
    assert.ok(handReach(strike, side).forward > .25, `${style} passo ${step} não termina à frente do corpo`);
    assert.ok(strike[`${side}Elbow`] > windup[`${side}Elbow`], `${style} passo ${step} não estende o cotovelo`);
  }
});

test("estocadas ganham alcance para a frente em vez de descer", () => {
  for (const style of ["thrust", "jab"]) for (const step of STEPS) {
    const impact = attackImpact(style);
    const strike = attackPose({ style, step, progress: impact });
    const side = strike.lead > 0 ? "right" : "left";
    const from = handReach(attackPose({ style, step, progress: impact * .55 }), side);
    const to = handReach(strike, side);
    assert.ok(to.forward > from.forward + .25, `${style} passo ${step} não estica o golpe`);
  }
});

test("golpes em arco erguem a arma antes de derrubá-la sobre o alvo", () => {
  for (const style of ["chop", "swing", "smash"]) for (const step of STEPS) {
    const impact = attackImpact(style);
    const windup = handReach(attackPose({ style, step, progress: impact * .55 }), "right");
    const strike = handReach(attackPose({ style, step, progress: impact }), "right");
    assert.ok(windup.height > .3, `${style} passo ${step} não ergue a arma`);
    assert.ok(strike.height < -.3, `${style} passo ${step} não desce a arma`);
  }
});

test("o tronco desengatilha o giro do windup para o impacto", () => {
  for (const style of STYLES) for (const step of STEPS) {
    const impact = attackImpact(style);
    const windup = attackPose({ style, step, progress: impact * .55 });
    const strike = attackPose({ style, step, progress: impact });
    assert.ok(windup.twist * strike.twist < 0, `${style} passo ${step} não inverte o giro`);
    assert.ok(strike.lean > windup.lean, `${style} passo ${step} não joga o peso à frente`);
  }
});

test("o corpo avança no impacto e volta ao lugar no fim", () => {
  for (const style of STYLES) for (const step of STEPS) {
    assert.ok(attackPose({ style, step, progress: attackImpact(style) }).lunge > .1);
    assert.equal(attackPose({ style, step, progress: 1 }).lunge, 0);
  }
});

test("o segundo golpe do combo vem do lado oposto ao primeiro", () => {
  for (const style of STYLES) {
    const impact = attackImpact(style);
    const first = attackPose({ style, step: 1, progress: impact });
    const second = attackPose({ style, step: 2, progress: impact });
    assert.ok(first.twist * second.twist < 0, `${style} repete o mesmo lado`);
  }
});

test("o combo desarmado alterna os punhos e espelha o corpo", () => {
  assert.equal(attackPose({ style: "jab", step: 1, progress: .4 }).lead, 1);
  assert.equal(attackPose({ style: "jab", step: 2, progress: .4 }).lead, -1);
  assert.equal(attackPose({ style: "jab", step: 3, progress: .4 }).lead, 1);
  const right = attackPose({ style: "jab", step: 1, progress: .4 });
  const left = attackPose({ style: "jab", step: 2, progress: .4 });
  assert.ok(Math.abs(right.rightArmX - left.leftArmX) < 1e-9);
  assert.ok(Math.abs(right.rightArmZ + left.leftArmZ) < 1e-9);
});

test("o finalizador é o golpe mais longo e mais pesado", () => {
  for (const style of STYLES) {
    assert.ok(attackDuration(style, 3) > attackDuration(style, 1));
    const impact = attackImpact(style);
    assert.ok(attackPose({ style, step: 3, progress: impact }).lunge > attackPose({ style, step: 1, progress: impact }).lunge);
  }
});

test("o impacto acontece depois da preparação e antes do fim", () => {
  for (const style of STYLES) {
    const impact = attackImpact(style);
    assert.ok(impact > .3 && impact < .65, `${style} bate fora da janela`);
  }
});

test("nenhuma junta ultrapassa o limite anatômico do rig", () => {
  for (const style of STYLES) for (const step of STEPS) {
    for (let progress = 0; progress <= 1.0001; progress += .02) {
      const pose = attackPose({ style, step, progress });
      for (const side of ["right", "left"]) {
        assert.ok(pose[`${side}ArmX`] >= -2.95 && pose[`${side}ArmX`] <= .6, `${style} ombro ${side} fora do limite`);
        // Cotovelo só dobra para um lado: valores positivos hiperestendem.
        assert.ok(pose[`${side}Elbow`] <= 0 && pose[`${side}Elbow`] >= -2.1, `${style} cotovelo ${side} fora do limite`);
        assert.ok(Math.abs(pose[`${side}ArmZ`]) <= 1, `${style} abdução ${side} fora do limite`);
      }
      assert.ok(Math.abs(pose.twist) <= .6 && Math.abs(pose.lean) <= .5);
      assert.ok(pose.drop <= 0 && pose.drop >= -.16);
    }
  }
});

test("passos fora da faixa do combo caem no golpe mais próximo", () => {
  const first = attackPose({ style: "chop", step: 1, progress: .5 });
  const clampedLow = attackPose({ style: "chop", step: 0, progress: .5 });
  const clampedHigh = attackPose({ style: "chop", step: 9, progress: .5 });
  const last = attackPose({ style: "chop", step: 3, progress: .5 });
  assert.deepEqual(clampedLow, first);
  assert.deepEqual(clampedHigh, last);
});

test("progresso fora de 0..1 é tratado como início ou fim", () => {
  assert.equal(attackPose({ style: "chop", step: 1, progress: -3 }).weight, 0);
  assert.equal(attackPose({ style: "chop", step: 1, progress: 4 }).weight, 0);
});
