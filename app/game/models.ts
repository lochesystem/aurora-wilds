import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { locomotionPose } from "./locomotion.js";

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
 * claro preso, botas de couro e escudo nas costas. Os nomes dos nós do rig
 * (`UpperBody`, `LeftArm`, ...) são contrato com `createPlayerAttackClips`.
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
  return {group,upperBody,torso,head,leftArm,rightArm,leftForearm,rightForearm,leftHand,rightHand,leftLeg,rightLeg,leftShin,rightShin,handSocket,scarf,antenna};
}

export function setPlayerEquipment(rig:PlayerRig,item:"hands"|"axe"|"pickaxe"|"hammer"|"spear"){
  rig.handSocket.clear();rig.handSocket.position.set(0,-.03,.02);rig.handSocket.rotation.set(0,0,0);if(item==="hands")return;
  const wood=new THREE.MeshToonMaterial({color:0x795137,gradientMap:toonGradient});const stone=new THREE.MeshToonMaterial({color:0x89938e,gradientMap:toonGradient});
  const shaft=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.035,.045,.82,7),wood));shaft.position.y=-.31;rig.handSocket.add(shaft);
  if(item==="axe"||item==="hammer"){
    const head=shadow(new THREE.Mesh(item==="axe"?new THREE.BoxGeometry(.38,.22,.1):rounded(.32,.2,.18,.035),stone));head.position.set(item==="axe"?.13:0,-.68,0);head.rotation.z=item==="axe"?-.22:0;rig.handSocket.add(head);
  }else if(item==="pickaxe"){
    const head=shadow(new THREE.Mesh(new THREE.ConeGeometry(.09,.72,6),stone));head.position.y=-.67;head.rotation.z=Math.PI/2;rig.handSocket.add(head);
  }else{
    rig.handSocket.position.set(0,0,.12);rig.handSocket.rotation.x=-Math.PI/2;
    shaft.scale.y=1.65;shaft.position.y=-.56;const tip=shadow(new THREE.Mesh(new THREE.ConeGeometry(.09,.35,7),stone));tip.position.y=-1.4;tip.rotation.z=Math.PI;rig.handSocket.add(tip);
  }
}

export type Equipment="hands"|"axe"|"pickaxe"|"hammer"|"spear";

const quaternionTrack=(node:string,times:number[],rotations:Array<[number,number,number]>)=>{
  const values=rotations.flatMap(([x,y,z])=>{const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(x,y,z));return[quaternion.x,quaternion.y,quaternion.z,quaternion.w]});
  return new THREE.QuaternionKeyframeTrack(`${node}.quaternion`,times,values);
};

export function createPlayerAttackClips(){
  const times=[0,.18,.34,.48,.62];
  const rest={rightArm:[0,0,.1] as [number,number,number],rightForearm:[-.12,0,0] as [number,number,number],rightHand:[0,0,0] as [number,number,number],leftArm:[0,0,-.1] as [number,number,number],leftForearm:[-.12,0,0] as [number,number,number],body:[0,0,0] as [number,number,number]};
  const clip=(name:string,windup:typeof rest,impact:typeof rest,follow:typeof rest)=>new THREE.AnimationClip(name,.62,[
    quaternionTrack("RightArm",times,[rest.rightArm,windup.rightArm,impact.rightArm,follow.rightArm,rest.rightArm]),
    quaternionTrack("RightForearm",times,[rest.rightForearm,windup.rightForearm,impact.rightForearm,follow.rightForearm,rest.rightForearm]),
    quaternionTrack("RightHand",times,[rest.rightHand,windup.rightHand,impact.rightHand,follow.rightHand,rest.rightHand]),
    quaternionTrack("LeftArm",times,[rest.leftArm,windup.leftArm,impact.leftArm,follow.leftArm,rest.leftArm]),
    quaternionTrack("LeftForearm",times,[rest.leftForearm,windup.leftForearm,impact.leftForearm,follow.leftForearm,rest.leftForearm]),
    quaternionTrack("UpperBody",times,[rest.body,windup.body,impact.body,follow.body,rest.body]),
  ]);
  const chop1=clip("tool_combo_1",
    {rightArm:[.48,-.12,.46],rightForearm:[-1.38,.08,0],rightHand:[.12,0,0],leftArm:[-.34,0,-.24],leftForearm:[-.55,0,0],body:[-.08,-.26,0]},
    {rightArm:[-1.08,.1,.28],rightForearm:[-.32,0,0],rightHand:[-.15,0,0],leftArm:[-.34,0,-.24],leftForearm:[-.55,0,0],body:[.12,.16,0]},
    {rightArm:[-1.24,.04,.18],rightForearm:[-.2,0,0],rightHand:[-.08,0,0],leftArm:[-.2,0,-.16],leftForearm:[-.3,0,0],body:[.08,.1,0]});
  const chop2=clip("tool_combo_2",
    {rightArm:[-.62,.58,.34],rightForearm:[-.82,.08,0],rightHand:[.05,0,.2],leftArm:[-.25,0,-.2],leftForearm:[-.42,0,0],body:[-.02,.32,0]},
    {rightArm:[-1.05,-.58,.26],rightForearm:[-.24,0,0],rightHand:[-.12,0,-.16],leftArm:[-.34,0,-.24],leftForearm:[-.52,0,0],body:[.08,-.28,0]},
    {rightArm:[-1.18,-.28,.2],rightForearm:[-.18,0,0],rightHand:[-.06,0,-.08],leftArm:[-.2,0,-.16],leftForearm:[-.3,0,0],body:[.05,-.12,0]});
  const chop3=clip("tool_combo_3",
    {rightArm:[1.08,-.08,.5],rightForearm:[-1.52,.05,0],rightHand:[.18,0,0],leftArm:[-.42,0,-.28],leftForearm:[-.62,0,0],body:[-.12,-.3,0]},
    {rightArm:[-1.42,.04,.22],rightForearm:[-.08,0,0],rightHand:[-.2,0,0],leftArm:[-.46,0,-.3],leftForearm:[-.65,0,0],body:[.18,.22,0]},
    {rightArm:[-1.5,.02,.16],rightForearm:[-.08,0,0],rightHand:[-.1,0,0],leftArm:[-.28,0,-.2],leftForearm:[-.38,0,0],body:[.12,.12,0]});
  const thrust1=clip("spear_combo_1",
    {rightArm:[.55,-.18,.34],rightForearm:[-1.08,.06,0],rightHand:[.2,0,0],leftArm:[-.28,0,-.2],leftForearm:[-.48,0,0],body:[-.04,-.22,0]},
    {rightArm:[-1.28,.04,.2],rightForearm:[-.18,0,0],rightHand:[0,0,0],leftArm:[-.3,0,-.22],leftForearm:[-.5,0,0],body:[.07,.18,0]},
    {rightArm:[-1.34,.02,.15],rightForearm:[-.12,0,0],rightHand:[0,0,0],leftArm:[-.18,0,-.15],leftForearm:[-.28,0,0],body:[.05,.1,0]});
  const thrust2=clip("spear_combo_2",
    {rightArm:[-.82,.68,.3],rightForearm:[-.62,.08,0],rightHand:[.05,0,.18],leftArm:[-.26,0,-.2],leftForearm:[-.46,0,0],body:[-.02,.34,0]},
    {rightArm:[-.92,-.7,.24],rightForearm:[-.16,0,0],rightHand:[-.08,0,-.18],leftArm:[-.32,0,-.24],leftForearm:[-.52,0,0],body:[.06,-.34,0]},
    {rightArm:[-1.02,-.32,.18],rightForearm:[-.12,0,0],rightHand:[0,0,-.08],leftArm:[-.2,0,-.16],leftForearm:[-.3,0,0],body:[.04,-.16,0]});
  const thrust3=clip("spear_combo_3",
    {rightArm:[.7,-.26,.4],rightForearm:[-1.22,.06,0],rightHand:[.22,0,0],leftArm:[-.42,0,-.28],leftForearm:[-.62,0,0],body:[-.1,-.3,0]},
    {rightArm:[-1.52,.02,.18],rightForearm:[-.06,0,0],rightHand:[-.08,0,0],leftArm:[-.48,0,-.3],leftForearm:[-.68,0,0],body:[.2,.26,0]},
    {rightArm:[-1.58,.01,.14],rightForearm:[-.05,0,0],rightHand:[-.04,0,0],leftArm:[-.3,0,-.2],leftForearm:[-.4,0,0],body:[.13,.14,0]});
  return{chop:[chop1,chop2,chop3],thrust:[thrust1,thrust2,thrust3]};
}

export function animatePlayerModel(rig:PlayerRig,time:number,speed:number,grounded:boolean,verticalVelocity:number,running:boolean){
  const pose=locomotionPose(time,speed,running);
  const legBlend=running?.3:.22;
  rig.leftLeg.rotation.x=THREE.MathUtils.lerp(rig.leftLeg.rotation.x,pose.leftHip,legBlend);
  rig.rightLeg.rotation.x=THREE.MathUtils.lerp(rig.rightLeg.rotation.x,pose.rightHip,legBlend);
  rig.leftShin.rotation.x=THREE.MathUtils.lerp(rig.leftShin.rotation.x,pose.leftKnee,running?.34:.24);
  rig.rightShin.rotation.x=THREE.MathUtils.lerp(rig.rightShin.rotation.x,pose.rightKnee,running?.34:.24);
  rig.leftArm.rotation.x=THREE.MathUtils.lerp(rig.leftArm.rotation.x,pose.leftArm,running?.34:.25);
  rig.leftArm.rotation.z=THREE.MathUtils.lerp(rig.leftArm.rotation.z,-.1,.2);
  rig.leftForearm.rotation.x=THREE.MathUtils.lerp(rig.leftForearm.rotation.x,pose.leftElbow,running?.35:.25);
  rig.rightArm.rotation.x=THREE.MathUtils.lerp(rig.rightArm.rotation.x,pose.rightArm,running?.38:.32);
  rig.rightArm.rotation.y=THREE.MathUtils.lerp(rig.rightArm.rotation.y,0,.28);
  rig.rightArm.rotation.z=THREE.MathUtils.lerp(rig.rightArm.rotation.z,.1,.28);
  rig.rightForearm.rotation.x=THREE.MathUtils.lerp(rig.rightForearm.rotation.x,pose.rightElbow,running?.4:.32);
  rig.rightForearm.rotation.y=THREE.MathUtils.lerp(rig.rightForearm.rotation.y,0,.3);
  rig.rightHand.rotation.x=THREE.MathUtils.lerp(rig.rightHand.rotation.x,0,.3);
  rig.upperBody.rotation.z=THREE.MathUtils.lerp(rig.upperBody.rotation.z,pose.bodyRoll,.18);
  rig.upperBody.rotation.y=THREE.MathUtils.lerp(rig.upperBody.rotation.y,pose.bodyTwist,.22);
  rig.upperBody.rotation.x=THREE.MathUtils.lerp(rig.upperBody.rotation.x,pose.bodyLean,.22);
  rig.group.position.y=THREE.MathUtils.lerp(rig.group.position.y,grounded?pose.bodyBob:0,.24);
  rig.head.rotation.y=Math.sin(time*.22)*.035;
  rig.head.position.y=1.46+(grounded?pose.headBob:0);
  rig.antenna.rotation.x=Math.sin(time*.7)*.1+Math.min(.28,speed*.05);
  rig.antenna.rotation.z=Math.sin(time*.8)*.08;
  rig.scarf.forEach((joint,i)=>{joint.rotation.x=Math.sin(time*.65-i*.55)*.08+Math.max(-.25,Math.min(.3,-verticalVelocity*.012));joint.rotation.y=Math.sin(time*.5-i)*.07});
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
