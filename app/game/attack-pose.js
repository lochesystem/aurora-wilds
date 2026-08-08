const clamp01 = value => Math.max(0, Math.min(1, value));
const lerp = (from, to, alpha) => from + (to - from) * alpha;
const easeOut = t => 1 - (1 - t) ** 3;
const easeIn = t => t * t * t;
const easeInOut = t => (t < .5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const STYLE_BY_EQUIPMENT = { hands:"jab", axe:"chop", pickaxe:"swing", hammer:"smash", spear:"thrust" };

/**
 * Braços apontam para baixo em repouso e o modelo olha para +Z. Rotação x
 * negativa levanta o braço à frente (-PI/2 é horizontal, -PI é acima da
 * cabeça); z positivo afasta a mão do corpo para +X; y positivo no tronco gira
 * para a direita do personagem. Todas as poses abaixo seguem esse referencial.
 */
const STYLES = {
  chop: {
    arc:true, lift:1, reach:1, twoHanded:true,
    timing:{ windup:.34, impact:.5, follow:.68 },
    steps:[
      { sweep:1, power:1, duration:.58 },
      { sweep:-1, power:.94, duration:.54 },
      { sweep:.3, power:1.32, duration:.76 },
    ],
  },
  swing: {
    arc:true, lift:.78, reach:1.1, twoHanded:true,
    timing:{ windup:.32, impact:.47, follow:.66 },
    steps:[
      { sweep:1.15, power:.95, duration:.52 },
      { sweep:-1.15, power:.9, duration:.5 },
      { sweep:.4, power:1.25, duration:.7 },
    ],
  },
  smash: {
    arc:true, lift:1.18, reach:.9, twoHanded:true,
    timing:{ windup:.4, impact:.58, follow:.76 },
    steps:[
      { sweep:.5, power:1.15, duration:.74 },
      { sweep:-.55, power:1.1, duration:.72 },
      { sweep:.15, power:1.45, duration:.92 },
    ],
  },
  thrust: {
    arc:false, lift:.2, reach:1.25, twoHanded:true,
    timing:{ windup:.3, impact:.44, follow:.62 },
    steps:[
      { sweep:.4, power:1, duration:.5 },
      { sweep:-.4, power:.95, duration:.48 },
      { sweep:.2, power:1.3, duration:.66 },
    ],
  },
  jab: {
    arc:false, lift:.1, reach:1, twoHanded:false,
    timing:{ windup:.26, impact:.4, follow:.58 },
    // O lado alterna pelo braço que conduz, então o desvio lateral é escrito
    // sempre no referencial desse braço.
    steps:[
      { sweep:.5, power:.9, duration:.36, lead:1 },
      { sweep:.5, power:.95, duration:.36, lead:-1 },
      { sweep:.3, power:1.2, duration:.52, lead:1 },
    ],
  },
};

const POSE_KEYS = [
  "leadArmX","leadArmY","leadArmZ","leadElbow","leadWrist",
  "offArmX","offArmY","offArmZ","offElbow","offWrist",
  "twist","lean","roll","lunge","drop","stance",
];

export function attackStyleFor(equipment) {
  return STYLE_BY_EQUIPMENT[equipment] ?? "jab";
}

export function attackEquipmentForStep(currentEquipment,lockedEquipment,step){
  return step===1?currentEquipment:lockedEquipment;
}

function styleFor(style) {
  return STYLES[style] ?? STYLES.jab;
}

function stepFor(style, step) {
  const steps = styleFor(style).steps;
  return steps[Math.max(0, Math.min(steps.length - 1, Math.round(step) - 1))];
}

export function attackDuration(style, step) {
  return stepFor(style, step).duration;
}

/** Fração do golpe em que a arma encosta no alvo. */
export function attackImpact(style) {
  return styleFor(style).timing.impact;
}

function guardPose(style, sweep) {
  const twoHanded = style.twoHanded;
  return {
    leadArmX:-.46, leadArmY:0, leadArmZ:.2, leadElbow:-.8, leadWrist:0,
    offArmX: twoHanded ? -.42 : -1.12, offArmY:0, offArmZ: twoHanded ? .3 : .4,
    offElbow: twoHanded ? -.88 : -1.72, offWrist:0,
    twist:.04 * sweep, lean:.05, roll:0, lunge:0, drop:0, stance:.55,
  };
}

function arcPoses(style, sweep, power) {
  const { lift, reach, twoHanded } = style;
  return {
    windup:{
      leadArmX:-1.12 - lift * 1.28, leadArmY:-.26 * sweep, leadArmZ:.16 + .34 * sweep,
      leadElbow:-1.02 - .28 * lift, leadWrist:.24,
      offArmX: twoHanded ? -1.05 - lift * .92 : -1.18, offArmY:0,
      offArmZ: twoHanded ? .46 : .44, offElbow: twoHanded ? -1.32 : -1.78, offWrist:0,
      twist:.4 * sweep, lean:-.11 * power, roll:.08 * sweep,
      lunge:-.07 * power, drop:-.015, stance:.9,
    },
    strike:{
      leadArmX:-.28 - reach * .06, leadArmY:.14 * sweep, leadArmZ:.12 - .34 * sweep,
      leadElbow:-.15, leadWrist:-.3,
      offArmX: twoHanded ? -.52 : -1.02, offArmY:0,
      offArmZ: twoHanded ? .38 : .4, offElbow: twoHanded ? -.5 : -1.58, offWrist:0,
      twist:-.3 * sweep, lean:.27 * power, roll:-.06 * sweep,
      lunge:.16 * power, drop:-.07 * power, stance:1,
    },
    follow:{
      leadArmX:-.66, leadArmY:.06 * sweep, leadArmZ:.16 - .18 * sweep,
      leadElbow:-.44, leadWrist:-.12,
      offArmX: twoHanded ? -.6 : -1.08, offArmY:0,
      offArmZ: twoHanded ? .34 : .42, offElbow: twoHanded ? -.66 : -1.68, offWrist:0,
      twist:-.14 * sweep, lean:.13 * power, roll:-.03 * sweep,
      lunge:.06 * power, drop:-.03, stance:.85,
    },
  };
}

function thrustPoses(style, sweep, power) {
  const { lift, reach, twoHanded } = style;
  return {
    windup:{
      leadArmX:-.92 - lift * .4, leadArmY:-.18 * sweep, leadArmZ:.1 + .18 * sweep,
      leadElbow:-1.78, leadWrist:.1,
      offArmX: twoHanded ? -1 : -1.24, offArmY:0,
      offArmZ: twoHanded ? .5 : .46, offElbow: twoHanded ? -1.25 : -1.86, offWrist:0,
      twist:.34 * sweep, lean:-.09 * power, roll:.04 * sweep,
      lunge:-.09 * power, drop:-.02, stance:.92,
    },
    strike:{
      leadArmX:-1.46 - reach * .06, leadArmY:.06 * sweep, leadArmZ:.04 - .12 * sweep,
      leadElbow:-.05, leadWrist:0,
      offArmX: twoHanded ? -1.32 : -1, offArmY:0,
      offArmZ: twoHanded ? .44 : .4, offElbow: twoHanded ? -.58 : -1.54, offWrist:0,
      twist:-.2 * sweep, lean:.2 * power, roll:-.03 * sweep,
      lunge:.24 * power, drop:-.04 * power, stance:1,
    },
    follow:{
      leadArmX:-1.28, leadArmY:.03 * sweep, leadArmZ:.08 - .08 * sweep,
      leadElbow:-.42, leadWrist:0,
      offArmX:-1.1, offArmY:0, offArmZ:.42,
      offElbow: twoHanded ? -.8 : -1.66, offWrist:0,
      twist:-.09 * sweep, lean:.1 * power, roll:-.02 * sweep,
      lunge:.1 * power, drop:-.02, stance:.88,
    },
  };
}

function mixPose(from, to, alpha) {
  const pose = {};
  for (const key of POSE_KEYS) pose[key] = lerp(from[key], to[key], alpha);
  return pose;
}

/**
 * Antecipação lenta, golpe acelerado e recuperação suave. A janela de peso
 * abre e fecha em zero para o corpo voltar à locomoção sem estalo.
 */
function envelope(progress) {
  if (progress < .14) return easeInOut(progress / .14);
  if (progress > .8) return 1 - easeInOut((progress - .8) / .2);
  return 1;
}

function phasePose(style, poses, guard, progress) {
  const { windup, impact, follow } = style.timing;
  if (progress <= windup) return mixPose(guard, poses.windup, easeOut(progress / windup));
  if (progress <= impact) return mixPose(poses.windup, poses.strike, easeIn((progress - windup) / (impact - windup)));
  if (progress <= follow) return mixPose(poses.strike, poses.follow, easeOut((progress - impact) / (follow - impact)));
  return mixPose(poses.follow, guard, easeInOut((progress - follow) / (1 - follow)));
}

const NEUTRAL = Object.freeze({
  weight:0, lead:1, twoHanded:false,
  rightArmX:0, rightArmY:0, rightArmZ:0, rightElbow:0, rightWrist:0,
  leftArmX:0, leftArmY:0, leftArmZ:0, leftElbow:0, leftWrist:0,
  twist:0, lean:0, roll:0, lunge:0, drop:0, stance:0,
});

export const NEUTRAL_ATTACK = NEUTRAL;

/**
 * Pose absoluta do golpe para uma fração do tempo de ataque. O braço que
 * conduz vira esquerdo em alguns passos do combo desarmado, e nesse caso os
 * eixos laterais são espelhados.
 */
export function attackPose({ style, step, progress }) {
  const definition = styleFor(style);
  const config = stepFor(style, step);
  const lead = config.lead ?? 1;
  const time = clamp01(progress);
  const guard = guardPose(definition, config.sweep);
  const poses = definition.arc
    ? arcPoses(definition, config.sweep, config.power)
    : thrustPoses(definition, config.sweep, config.power);
  const pose = phasePose(definition, poses, guard, time);
  const mirror = lead < 0 ? -1 : 1;
  const leadSide = {
    ArmX: pose.leadArmX, ArmY: pose.leadArmY * mirror, ArmZ: pose.leadArmZ * mirror,
    Elbow: pose.leadElbow, Wrist: pose.leadWrist,
  };
  const offSide = {
    ArmX: pose.offArmX, ArmY: pose.offArmY * mirror, ArmZ: pose.offArmZ * mirror,
    Elbow: pose.offElbow, Wrist: pose.offWrist,
  };
  const right = lead > 0 ? leadSide : offSide;
  const left = lead > 0 ? offSide : leadSide;
  return {
    weight: envelope(time),
    lead, twoHanded:definition.twoHanded,
    rightArmX: right.ArmX, rightArmY: right.ArmY, rightArmZ: right.ArmZ,
    rightElbow: right.Elbow, rightWrist: right.Wrist,
    leftArmX: left.ArmX, leftArmY: left.ArmY, leftArmZ: left.ArmZ,
    leftElbow: left.Elbow, leftWrist: left.Wrist,
    twist: pose.twist * mirror, lean: pose.lean, roll: pose.roll * mirror,
    lunge: pose.lunge, drop: pose.drop, stance: pose.stance,
  };
}
