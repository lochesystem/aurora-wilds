import * as THREE from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";

export interface PlayerRig {
  group: THREE.Group;
  torso: THREE.Mesh;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
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

function shadow(mesh: THREE.Mesh) {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function createPlayerModel(): PlayerRig {
  const group = new THREE.Group();
  const cream = new THREE.MeshStandardMaterial({color:0xfff4d7,roughness:.48,metalness:.04});
  const creamDark = new THREE.MeshStandardMaterial({color:0xd9d6c9,roughness:.58});
  const navy = new THREE.MeshStandardMaterial({color:0x173d69,roughness:.42,metalness:.12});
  const navyDark = new THREE.MeshStandardMaterial({color:0x0b203e,roughness:.35,metalness:.28});
  const coral = new THREE.MeshStandardMaterial({color:0xff6955,roughness:.52});
  const gold = new THREE.MeshStandardMaterial({color:0xffc85a,roughness:.35,metalness:.45});
  const visor = new THREE.MeshPhysicalMaterial({color:0x112946,emissive:0x163d5f,emissiveIntensity:.8,roughness:.16,metalness:.55,clearcoat:1,clearcoatRoughness:.12});
  const glow = new THREE.MeshStandardMaterial({color:0xa7fff1,emissive:0x48e8da,emissiveIntensity:4,roughness:.18});

  const torso = shadow(new THREE.Mesh(rounded(.72,.77,.53,.14),navy));
  torso.position.y=.78; torso.rotation.x=-.03; group.add(torso);
  const chest = shadow(new THREE.Mesh(rounded(.48,.23,.035,.035),cream));
  chest.position.set(0,.84,.283); group.add(chest);
  const chestCore = new THREE.Mesh(new THREE.CircleGeometry(.07,16),glow);
  chestCore.position.set(0,.84,.305); group.add(chestCore);
  const belt = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.39,.39,.14,16),gold));
  belt.position.y=.43; group.add(belt);
  const backpack = shadow(new THREE.Mesh(rounded(.48,.48,.2,.09),navyDark));
  backpack.position.set(0,.82,-.36); group.add(backpack);
  for(const side of [-1,1]){const vent=new THREE.Mesh(rounded(.08,.28,.025,.02),glow);vent.position.set(side*.13,.82,-.47);group.add(vent)}

  const head = new THREE.Group(); head.position.y=1.44; group.add(head);
  const helmet = shadow(new THREE.Mesh(rounded(.87,.62,.72,.25),cream)); head.add(helmet);
  const faceplate = shadow(new THREE.Mesh(rounded(.68,.34,.055,.1),visor)); faceplate.position.set(0,0,.372); head.add(faceplate);
  for(const side of [-1,1]){const eye=new THREE.Mesh(rounded(.085,.13,.018,.025),glow);eye.position.set(side*.16,.015,.407);head.add(eye);const ear=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.12,.12,.1,12),gold));ear.position.set(side*.47,0,0);ear.rotation.z=Math.PI/2;head.add(ear)}
  const brow = new THREE.Mesh(rounded(.38,.035,.018,.01),creamDark); brow.position.set(0,.13,.412); head.add(brow);

  const antenna = new THREE.Group(); antenna.position.set(.22,.34,0); head.add(antenna);
  const stem = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.025,.035,.25,8),navyDark));stem.position.y=.11;stem.rotation.z=-.18;antenna.add(stem);
  const antennaGlow = new THREE.Mesh(new THREE.OctahedronGeometry(.075,1),glow);antennaGlow.position.set(-.02,.25,0);antenna.add(antennaGlow);

  const makeArm=(side:number)=>{const pivot=new THREE.Group();pivot.position.set(side*.43,1.06,0);group.add(pivot);const shoulder=shadow(new THREE.Mesh(new THREE.SphereGeometry(.16,12,9),cream));pivot.add(shoulder);const upper=shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.105,.34,5,8),creamDark));upper.position.y=-.25;upper.rotation.z=side*.08;pivot.add(upper);const cuff=shadow(new THREE.Mesh(new THREE.CylinderGeometry(.13,.13,.12,12),gold));cuff.position.y=-.48;pivot.add(cuff);const hand=shadow(new THREE.Mesh(new THREE.SphereGeometry(.15,12,9),cream));hand.position.y=-.59;hand.scale.set(1,.82,1);pivot.add(hand);return pivot};
  const leftArm=makeArm(-1),rightArm=makeArm(1);

  const makeLeg=(side:number)=>{const pivot=new THREE.Group();pivot.position.set(side*.2,.42,0);group.add(pivot);const leg=shadow(new THREE.Mesh(new THREE.CapsuleGeometry(.12,.22,5,8),navyDark));leg.position.y=-.17;pivot.add(leg);const boot=shadow(new THREE.Mesh(rounded(.31,.22,.48,.1),coral));boot.position.set(0,-.39,.09);boot.rotation.x=-.05;pivot.add(boot);const sole=shadow(new THREE.Mesh(rounded(.29,.055,.47,.025),navyDark));sole.position.set(0,-.515,.1);pivot.add(sole);return pivot};
  const leftLeg=makeLeg(-1),rightLeg=makeLeg(1);

  const collar=shadow(new THREE.Mesh(new THREE.TorusGeometry(.34,.07,8,20),coral));collar.position.y=1.18;collar.rotation.x=Math.PI/2;group.add(collar);
  const scarf:THREE.Group[]=[];let parent=group;
  for(let i=0;i<3;i++){const joint=new THREE.Group();joint.position.set(0,i===0?1.18:0,-(i===0?.37:.27));parent.add(joint);const cloth=shadow(new THREE.Mesh(rounded(.26-i*.035,.08,.34,.035),coral));cloth.position.z=-.15;cloth.rotation.x=.08; joint.add(cloth);scarf.push(joint);parent=joint}

  group.scale.setScalar(1.02);
  return {group,torso,head,leftArm,rightArm,leftLeg,rightLeg,scarf,antenna};
}

export function animatePlayerModel(rig:PlayerRig,time:number,speed:number,grounded:boolean,verticalVelocity:number,attacking:boolean){
  const moving=Math.min(1,speed);const stride=Math.sin(time*1.15)*moving;
  rig.leftLeg.rotation.x=THREE.MathUtils.lerp(rig.leftLeg.rotation.x,stride*.72,.22);
  rig.rightLeg.rotation.x=THREE.MathUtils.lerp(rig.rightLeg.rotation.x,-stride*.72,.22);
  rig.leftArm.rotation.x=THREE.MathUtils.lerp(rig.leftArm.rotation.x,-stride*.52,.18);
  rig.rightArm.rotation.x=THREE.MathUtils.lerp(rig.rightArm.rotation.x,attacking?-1.7:stride*.52,.25);
  rig.rightArm.rotation.z=THREE.MathUtils.lerp(rig.rightArm.rotation.z,attacking?-.75:0,.2);
  rig.torso.rotation.z=THREE.MathUtils.lerp(rig.torso.rotation.z,moving*Math.sin(time*.55)*.035,.15);
  rig.head.rotation.y=Math.sin(time*.22)*.035;
  rig.head.position.y=1.44+(grounded?Math.abs(Math.sin(time*1.15))*moving*.025:0);
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
