import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { locomotionPose } from "./locomotion.js";
import { attackPose, NEUTRAL_ATTACK } from "./attack-pose.js";

export interface PlayerRig {
  group: THREE.Group;
  upperBody: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftForearm: THREE.Group;
  rightForearm: THREE.Group;
  leftHand: THREE.Group;
  rightHand: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  leftShin: THREE.Group;
  rightShin: THREE.Group;
  handSocket: THREE.Group;
  weaponRoot: THREE.Group;
  offHandGrip: THREE.Group;
  scarf: THREE.Group[];
  antenna: THREE.Group;
}

export interface GuardianRig {
  group: THREE.Group;
  shell: THREE.Group;
  legs: THREE.Group[];
  core: THREE.Mesh;
}

const rounded = (w:number,h:number,d:number,r=.08) => new RoundedBoxGeometry(w,h,d,4,r);
export const PLAYER_MODEL_GROUND_OFFSET=.38;
let toonGradient: THREE.Texture | undefined;

function shadow(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/**
 * Herói de aventura no vocabulário do BotW: túnica com barra solta, cabelo
 * claro preso, botas de couro e escudo nas costas. Os nós ganham nome para
 * ficarem legíveis no inspetor; a animação usa as referências do rig.
 */
export function createPlayerModel(gradientMap?: THREE.Texture): PlayerRig {
  toonGradient=gradientMap;
  const group = new THREE.Group();
  const upperBody = new THREE.Group();upperBody.name="UpperBody";group.add(upperBody);
  const toon=(color:number)=>new THREE.MeshToonMaterial({color,gradientMap});
  const skin=toon(0xf2c79c);
  const hair=toon(0xe6c469);
  const hairShade=toon(0xc09b41);
  const tunic=toon(0x2f6fa8);
  const tunicShade=toon(0x23557f);
  const trim=toon(0xe7c064);
  const linen=toon(0xeadfcb);
  const pants=toon(0xd8cbb0);
  const leather=toon(0x6d4b30);
  const leatherDark=toon(0x452c1b);
  const steel=toon(0xb6c3cd);
  const iris=toon(0x2a4a72);

  const torso = shadow(new THREE.Mesh(rounded(.66,.72,.44,.16),tunic));
  torso.position.y=.82; torso.rotation.x=-.03; upperBody.add(torso);
  const collarPiece = shadow(new THREE.Mesh(rounded(.5,.2,.42,.09),linen));
  collarPiece.position.y=1.16; upperBody.add(collarPiece);
  for(const side of [-1,1]){const lapel=shadow(new THREE.Mesh(rounded(.09,.5,.05,.02),trim));lapel.position.set(side*.13,.94,.22);lapel.rotation.z=side*.16;upperBody.add(lapel)}
  const belt = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,.13,14),leather));
  belt.position.y=.5; upperBody.add(belt);
  const buckle = shadow(new THREE.Mesh(rounded(.14,.14,.06,.02),trim));
  buckle.position.set(0,.5,.31); upperBody.add(buckle);
  for(const side of [-1,1]){const strap=shadow(new THREE.Mesh(rounded(.1,.72,.05,.02),leather));strap.position.set(side*.16,.95,-.05);strap.rotation.set(0,0,side*.22);upperBody.add(strap)}

  const shield = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.32,.32,.07,12),steel));
  shield.position.set(-.05,.92,-.3); shield.rotation.set(Math.PI/2,0,.22); upperBody.add(shield);
  const shieldBoss = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.11,.11,.09,10),trim));
  shieldBoss.position.set(-.05,.92,-.34); shieldBoss.rotation.set(Math.PI/2,0,0); upperBody.add(shieldBoss);
  const sheath = shadow(new THREE.Mesh(rounded(.13,.86,.07,.03),leatherDark));
  sheath.position.set(.2,1.02,-.28); sheath.rotation.set(.1,0,-.42); upperBody.add(sheath);

  const head = new THREE.Group(); head.position.y=1.46; upperBody.add(head);
  const skull = shadow(new THREE.Mesh(rounded(.46,.5,.44,.17),skin)); head.add(skull);
  const jaw = shadow(new THREE.Mesh(rounded(.34,.2,.36,.1),skin)); jaw.position.set(0,-.19,.02); head.add(jaw);
  const cap = shadow(new THREE.Mesh(rounded(.5,.42,.48,.19),hair)); cap.position.set(0,.09,-.03); head.add(cap);
  for(const side of [-1,1]){
    const bang=shadow(new THREE.Mesh(rounded(.16,.3,.1,.05),hair));bang.position.set(side*.16,.13,.21);bang.rotation.z=side*.2;head.add(bang);
    const sideburn=shadow(new THREE.Mesh(rounded(.09,.36,.24,.05),hairShade));sideburn.position.set(side*.24,-.02,-.02);head.add(sideburn);
    const ear=shadow(new THREE.Mesh(new THREE.ConeGeometry(.07,.24,6),skin));ear.position.set(side*.27,.02,-.05);ear.rotation.set(0,0,-side*1.05);head.add(ear);
    const eye=new THREE.Mesh(rounded(.07,.1,.02,.02),iris);eye.position.set(side*.11,-.02,.225);head.add(eye);
    const brow=new THREE.Mesh(rounded(.1,.028,.02,.01),hairShade);brow.position.set(side*.11,.08,.228);brow.rotation.z=-side*.12;head.add(brow);
  }
  const fringe = shadow(new THREE.Mesh(rounded(.44,.14,.12,.05),hair)); fringe.position.set(0,.2,.17); fringe.rotation.x=.18; head.add(fringe);

  const antenna = new THREE.Group(); antenna.position.set(0,.12,-.24); head.add(antenna);
  const tieBand = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.06,.06,.07,8),leather)); tieBand.rotation.x=Math.PI/2.4; antenna.add(tieBand);
  const ponytail = shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.07,.26,4,7),hair)); ponytail.position.set(0,-.14,-.1); ponytail.rotation.x=-.34; antenna.add(ponytail);
  const ponytailTip = shadow(new THREE.Mesh(new THREE.ConeGeometry(.06,.2,7),hairShade)); ponytailTip.position.set(0,-.33,-.17); ponytailTip.rotation.x=Math.PI+.34; antenna.add(ponytailTip);

  const makeArm=(side:number)=>{
    const upperArm=new THREE.Group();upperArm.name=side<0?"LeftArm":"RightArm";upperArm.position.set(side*.42,1.08,0);upperArm.rotation.z=side*.1;upperBody.add(upperArm);
    const shoulder=shadow(new THREE.Mesh(new THREE.SphereGeometry(.15,12,9),tunic));upperArm.add(shoulder);
    const sleeve=shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.1,.2,5,8),linen));sleeve.position.y=-.19;upperArm.add(sleeve);
    const forearm=new THREE.Group();forearm.name=side<0?"LeftForearm":"RightForearm";forearm.position.y=-.4;upperArm.add(forearm);
    const lower=shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.085,.19,5,8),skin));lower.position.y=-.17;forearm.add(lower);
    const bracer=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.11,.1,.2,10),leather));bracer.position.y=-.28;forearm.add(bracer);
    const handJoint=new THREE.Group();handJoint.name=side<0?"LeftHand":"RightHand";handJoint.position.y=-.43;forearm.add(handJoint);
    const hand=shadow(new THREE.Mesh(new THREE.SphereGeometry(.115,12,9),skin));hand.scale.set(1,.9,.86);handJoint.add(hand);
    return{upperArm,forearm,handJoint};
  };
  const leftArmRig=makeArm(-1),rightArmRig=makeArm(1);
  const leftArm=leftArmRig.upperArm,rightArm=rightArmRig.upperArm,leftForearm=leftArmRig.forearm,rightForearm=rightArmRig.forearm,leftHand=leftArmRig.handJoint,rightHand=rightArmRig.handJoint;
  const handSocket=new THREE.Group();handSocket.position.set(0,-.03,.02);rightHand.add(handSocket);
  const weaponRoot=new THREE.Group();handSocket.add(weaponRoot);
  const offHandGrip=new THREE.Group();offHandGrip.visible=false;handSocket.add(offHandGrip);

  const makeLeg=(side:number)=>{const hip=new THREE.Group();hip.position.set(side*.18,.46,0);group.add(hip);const thigh=shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.12,.14,5,8),pants));thigh.position.y=-.14;hip.add(thigh);const shin=new THREE.Group();shin.position.y=-.32;hip.add(shin);const lower=shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.1,.12,5,8),pants));lower.position.y=-.12;shin.add(lower);const bootShaft=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.13,.15,.26,10),leather));bootShaft.position.y=-.24;shin.add(bootShaft);const boot=shadow(new THREE.Mesh(rounded(.26,.19,.42,.08),leather));boot.position.set(0,-.4,.07);boot.rotation.x=-.05;shin.add(boot);const sole=shadow(new THREE.Mesh(rounded(.25,.06,.42,.025),leatherDark));sole.position.set(0,-.5,.08);shin.add(sole);return{hip,shin}};
  const leftLegRig=makeLeg(-1),rightLegRig=makeLeg(1),leftLeg=leftLegRig.hip,rightLeg=rightLegRig.hip,leftShin=leftLegRig.shin,rightShin=rightLegRig.shin;

  // A barra da túnica usa os nós de "scarf": três abas soltas que o animador
  // já balança por índice, o que dá o tecido em movimento constante.
  const scarf:THREE.Group[]=[];
  for(const [index,angle] of [Math.PI,-.8,.8].entries()){
    const joint=new THREE.Group();joint.position.set(Math.sin(angle)*.2,.5,Math.cos(angle)*.2);joint.rotation.y=angle;upperBody.add(joint);
    const cloth=shadow(new THREE.Mesh(rounded(index===0?.42:.3,.46,.07,.03),index===0?tunicShade:tunic));
    cloth.position.set(0,-.22,.03);cloth.rotation.x=-.12;joint.add(cloth);
    scarf.push(joint);
  }

  group.scale.setScalar(1.02);
  return {group,upperBody,torso,head,leftArm,rightArm,leftForearm,rightForearm,leftHand,rightHand,leftLeg,rightLeg,leftShin,rightShin,handSocket,weaponRoot,offHandGrip,scarf,antenna};
}

export function setPlayerEquipment(rig:PlayerRig,item:"hands"|"axe"|"pickaxe"|"hammer"|"spear"){
  rig.weaponRoot.clear();rig.handSocket.position.set(0,-.03,.02);rig.handSocket.rotation.set(0,0,0);rig.offHandGrip.visible=item!=="hands";rig.offHandGrip.position.set(0,-.34,0);if(item==="hands")return;
  const wood=new THREE.MeshToonMaterial({color:0x795137,gradientMap:toonGradient});const stone=new THREE.MeshToonMaterial({color:0x89938e,gradientMap:toonGradient});
  const shaft=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.82,7),wood));shaft.position.y=-.31;rig.weaponRoot.add(shaft);
  if(item==="axe"||item==="hammer"){
    const head=shadow(new THREE.Mesh(item==="axe"?new THREE.BoxGeometry(.38,.22,.1):rounded(.32,.2,.18,.035),stone));head.position.set(item==="axe"?.13:0,-.68,0);head.rotation.z=item==="axe"?-.22:0;rig.weaponRoot.add(head);
  }else if(item==="pickaxe"){
    const head=shadow(new THREE.Mesh(new THREE.ConeGeometry(.09,.72,6),stone));head.position.y=-.67;head.rotation.z=Math.PI/2;rig.weaponRoot.add(head);
  }else{
    rig.handSocket.position.set(0,0,.12);rig.handSocket.rotation.x=-Math.PI/2;
    rig.offHandGrip.position.y=-.42;
    shaft.scale.y=1.65;shaft.position.y=-.56;const tip=shadow(new THREE.Mesh(new THREE.ConeGeometry(.09,.35,7),stone));tip.position.y=-1.4;tip.rotation.z=Math.PI;rig.weaponRoot.add(tip);
  }
}

export type Equipment="hands"|"axe"|"pickaxe"|"hammer"|"spear";

export interface AttackState { style:string; step:number; progress:number }

const lerp=THREE.MathUtils.lerp;

const IK_DOWN=new THREE.Vector3(0,-1,0);
const IK_POLE=new THREE.Vector3(-1,.08,.22);

function applyOffHandGrip(rig:PlayerRig,weight:number){
  if(!rig.offHandGrip.visible||weight<=.001)return;
  rig.group.updateMatrixWorld(true);
  const target=rig.offHandGrip.getWorldPosition(new THREE.Vector3());
  rig.upperBody.worldToLocal(target);
  const shoulder=rig.leftArm.position;
  const toTarget=target.clone().sub(shoulder);
  const upperLength=.4,lowerLength=.43;
  const distance=THREE.MathUtils.clamp(toTarget.length(),Math.abs(upperLength-lowerLength)+.001,upperLength+lowerLength-.012);
  const direction=toTarget.normalize();
  const along=(upperLength*upperLength-lowerLength*lowerLength+distance*distance)/(2*distance);
  const height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
  const pole=IK_POLE.clone().sub(direction.clone().multiplyScalar(IK_POLE.dot(direction)));
  if(pole.lengthSq()<.0001)pole.set(0,0,1);else pole.normalize();
  const elbow=shoulder.clone().addScaledVector(direction,along).addScaledVector(pole,height);
  const upperDirection=elbow.sub(shoulder).normalize();
  const lowerDirection=target.sub(shoulder.clone().addScaledVector(upperDirection,upperLength)).normalize();
  const upperTarget=new THREE.Quaternion().setFromUnitVectors(IK_DOWN,upperDirection);
  const lowerLocal=lowerDirection.applyQuaternion(upperTarget.clone().invert());
  const forearmTarget=new THREE.Quaternion().setFromUnitVectors(IK_DOWN,lowerLocal);
  const gripWeight=THREE.MathUtils.smoothstep(weight,0,1)*.96;
  rig.leftArm.quaternion.slerp(upperTarget,gripWeight);
  rig.leftForearm.quaternion.slerp(forearmTarget,gripWeight);
}

export function animatePlayerModel(rig:PlayerRig,time:number,speed:number,grounded:boolean,verticalVelocity:number,running:boolean,attack:AttackState|null=null){
  const pose=locomotionPose(time,speed,running);
  const strike=attack?attackPose(attack):NEUTRAL_ATTACK;
  const weight=strike.weight;
  // Mistura entre andar e golpear. O golpe também acelera a resposta das
  // juntas: com o amortecimento da caminhada o impacto sairia mole.
  const blend=(walking:number)=>lerp(walking,.92,weight);
  const mix=(walking:number,striking:number)=>lerp(walking,striking,weight);

  const legStance=weight*strike.stance*(1-pose.motion);
  const frontLeg=strike.lead>0?"left":"right";
  const legBlend=lerp(running?.3:.22,.6,legStance);
  rig.leftLeg.rotation.x=lerp(rig.leftLeg.rotation.x,lerp(pose.leftHip,frontLeg==="left"?-.3:.22,legStance),legBlend);
  rig.rightLeg.rotation.x=lerp(rig.rightLeg.rotation.x,lerp(pose.rightHip,frontLeg==="left"?.22:-.3,legStance),legBlend);
  rig.leftShin.rotation.x=lerp(rig.leftShin.rotation.x,lerp(pose.leftKnee,frontLeg==="left"?.18:.36,legStance),lerp(running?.34:.24,.6,legStance));
  rig.rightShin.rotation.x=lerp(rig.rightShin.rotation.x,lerp(pose.rightKnee,frontLeg==="left"?.36:.18,legStance),lerp(running?.34:.24,.6,legStance));

  rig.leftArm.rotation.x=lerp(rig.leftArm.rotation.x,mix(pose.leftArm,strike.leftArmX),blend(running?.34:.25));
  rig.leftArm.rotation.y=lerp(rig.leftArm.rotation.y,mix(0,strike.leftArmY),blend(.24));
  rig.leftArm.rotation.z=lerp(rig.leftArm.rotation.z,mix(-.1,strike.leftArmZ),blend(.2));
  rig.leftForearm.rotation.x=lerp(rig.leftForearm.rotation.x,mix(pose.leftElbow,strike.leftElbow),blend(running?.35:.25));
  rig.leftHand.rotation.x=lerp(rig.leftHand.rotation.x,mix(0,strike.leftWrist),blend(.3));
  rig.rightArm.rotation.x=lerp(rig.rightArm.rotation.x,mix(pose.rightArm,strike.rightArmX),blend(running?.38:.32));
  rig.rightArm.rotation.y=lerp(rig.rightArm.rotation.y,mix(0,strike.rightArmY),blend(.28));
  rig.rightArm.rotation.z=lerp(rig.rightArm.rotation.z,mix(.1,strike.rightArmZ),blend(.28));
  rig.rightForearm.rotation.x=lerp(rig.rightForearm.rotation.x,mix(pose.rightElbow,strike.rightElbow),blend(running?.4:.32));
  rig.rightForearm.rotation.y=lerp(rig.rightForearm.rotation.y,0,.3);
  rig.rightHand.rotation.x=lerp(rig.rightHand.rotation.x,mix(0,strike.rightWrist),blend(.3));
  if(strike.twoHanded)applyOffHandGrip(rig,weight);

  rig.upperBody.rotation.z=lerp(rig.upperBody.rotation.z,mix(pose.bodyRoll,strike.roll),blend(.18));
  rig.upperBody.rotation.y=lerp(rig.upperBody.rotation.y,mix(pose.bodyTwist,strike.twist),blend(.22));
  rig.upperBody.rotation.x=lerp(rig.upperBody.rotation.x,mix(pose.bodyLean,strike.lean),blend(.22));

  // O avanço acompanha a direção em que o modelo está virado, então o golpe
  // joga o corpo para cima do alvo em vez de deslizar num eixo fixo do mundo.
  const facing=rig.group.rotation.y;
  const lunge=weight*strike.lunge;
  rig.group.position.x=lerp(rig.group.position.x,Math.sin(facing)*lunge,blend(.3));
  rig.group.position.z=lerp(rig.group.position.z,Math.cos(facing)*lunge,blend(.3));
  rig.group.position.y=lerp(rig.group.position.y,(grounded?pose.bodyBob:0)+weight*strike.drop,blend(.24));

  rig.head.rotation.y=Math.sin(time*.22)*.035-strike.twist*weight*.3;
  rig.head.rotation.x=lerp(rig.head.rotation.x,weight*.16,blend(.25));
  rig.head.position.y=1.46+(grounded?pose.headBob:0);
  rig.antenna.rotation.x=Math.sin(time*.7)*.1+Math.min(.28,speed*.05)-weight*strike.lean*.7;
  rig.antenna.rotation.z=Math.sin(time*.8)*.08;
  rig.scarf.forEach((joint,i)=>{joint.rotation.x=Math.sin(time*.65-i*.55)*.08+Math.max(-.25,Math.min(.3,-verticalVelocity*.012))-weight*strike.lunge*.9;joint.rotation.y=Math.sin(time*.5-i)*.07+weight*strike.twist*.35});
}

export function createGuardianModel(index:number):GuardianRig{
  const group=new THREE.Group();const primary=index%2?0x7553a5:0xd95562;const secondary=index%2?0x4a3675:0x933547;
  const shellMat=new THREE.MeshStandardMaterial({color:primary,roughness:.36,metalness:.2});
  const plateMat=new THREE.MeshStandardMaterial({color:secondary,roughness:.42,metalness:.28});
  const dark=new THREE.MeshStandardMaterial({color:0x202542,roughness:.58,metalness:.12});
  const gold=new THREE.MeshStandardMaterial({color:0xffcc65,roughness:.28,metalness:.55});
  const glow=new THREE.MeshStandardMaterial({color:0xffed92,emissive:0xffa62f,emissiveIntensity:3});
  const shell=new THREE.Group();shell.position.y=.55;group.add(shell);
  const back=shadow(new THREE.Mesh(new THREE.SphereGeometry(.62,18,12),shellMat));back.scale.set(1,.68,1.18);shell.add(back);
  const split=new THREE.Mesh(rounded(.035,.48,1.05,.015),plateMat);split.position.y=.08;split.rotation.x=Math.PI/2;shell.add(split);
  for(const side of [-1,1]){const plate=shadow(new THREE.Mesh(new THREE.SphereGeometry(.46,14,9),plateMat));plate.scale.set(.68,.34,.75);plate.position.set(side*.29,.16,-.02);plate.rotation.z=side*.12;shell.add(plate)}
  const rim=shadow(new THREE.Mesh(new THREE.TorusGeometry(.47,.055,7,20),gold));rim.scale.z=1.18;rim.rotation.x=Math.PI/2;rim.position.y=.08;shell.add(rim);
  const core=new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.045,16),glow);core.position.set(0,.48,0);shell.add(core);
  const head=shadow(new THREE.Mesh(new THREE.SphereGeometry(.37,14,9),dark));head.scale.set(1,.72,.72);head.position.set(0,.42,.55);group.add(head);
  for(const side of [-1,1]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.055,9,6),glow);eye.position.set(side*.13,.48,.81);group.add(eye);const horn=shadow(new THREE.Mesh(new THREE.ConeGeometry(.07,.35,8),gold));horn.position.set(side*.2,.65,.72);horn.rotation.x=Math.PI/3;horn.rotation.z=-side*.22;group.add(horn)}
  const legs:THREE.Group[]=[];
  for(const side of [-1,1])for(let i=0;i<3;i++){const pivot=new THREE.Group();pivot.position.set(side*.43,.36,(i-1)*.34);pivot.rotation.z=-side*.65;group.add(pivot);const upper=shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.055,.28,3,6),dark));upper.position.y=-.16;pivot.add(upper);const foot=shadow(new THREE.Mesh(new THREE.ConeGeometry(.07,.3,6),gold));foot.position.set(side*.08,-.36,.04);foot.rotation.z=side*.55;pivot.add(foot);legs.push(pivot)}
  return {group,shell,legs,core};
}

export function animateGuardianModel(rig:GuardianRig,time:number,phase:number){
  rig.shell.rotation.y=Math.sin(time*.8+phase)*.12;rig.shell.position.y=.55+Math.sin(time*3+phase)*.045;
  rig.core.rotation.y+=.06;rig.core.scale.setScalar(1+Math.sin(time*4+phase)*.08);
  rig.legs.forEach((leg,i)=>{const side=i<3?-1:1;leg.rotation.x=Math.sin(time*4.2+phase+i*Math.PI/2)*.18;leg.rotation.z=-side*(.62+Math.sin(time*3.2+phase+i)*.08)});
}
