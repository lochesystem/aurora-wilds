import * as THREE from "three";

export type GrassInteraction = {
  time: {value:number};
  player: {value:THREE.Vector3};
  trail: {value:THREE.Vector3};
  velocity: {value:THREE.Vector3};
};

export function createGrassGeometry(){
  const positions:number[]=[];
  const indices:number[]=[];
  const colors:number[]=[];
  // Degradê da base escura para a ponta clara. É o que faz o campo parecer
  // pintado em camadas em vez de um tapete verde chapado.
  const shade=(height:number)=>{const tone=.46+height*.52;colors.push(tone*.86,tone,tone*.72)};
  for(let blade=0;blade<6;blade+=1){
    const angle=blade*2.399963;
    const rx=Math.cos(angle),rz=Math.sin(angle),bx=-rz,bz=rx;
    const radius=blade===0?0:.045+(blade%3)*.035;
    const centerX=Math.cos(angle+.72)*radius,centerZ=Math.sin(angle+.72)*radius;
    const halfWidth=.042+(blade%2)*.014;
    const height=.6+(blade%3)*.12;
    const start=positions.length/3;
    positions.push(
      centerX-rx*halfWidth,0,centerZ-rz*halfWidth,
      centerX+rx*halfWidth,0,centerZ+rz*halfWidth,
      centerX-rx*halfWidth*.68+bx*.018,height*.53,centerZ-rz*halfWidth*.68+bz*.018,
      centerX+rx*halfWidth*.68+bx*.018,height*.53,centerZ+rz*halfWidth*.68+bz*.018,
      centerX+bx*.07,height,centerZ+bz*.07,
    );
    shade(0);shade(0);shade(.53);shade(.53);shade(1);
    indices.push(start,start+1,start+2,start+1,start+3,start+2,start+2,start+3,start+4);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

export function createFlowerGeometry(){
  const positions:number[]=[];
  const colors:number[]=[];
  const indices:number[]=[];
  const push=(x:number,y:number,z:number,r:number,g:number,b:number)=>{positions.push(x,y,z);colors.push(r,g,b)};
  const stemHalf=.012;
  push(-stemHalf,0,0,.24,.42,.2);push(stemHalf,0,0,.24,.42,.2);
  push(-stemHalf,.34,0,.42,.62,.3);push(stemHalf,.34,0,.42,.62,.3);
  indices.push(0,1,2,1,3,2);
  const petals=5;
  for(let index=0;index<petals;index+=1){
    const angle=index/petals*Math.PI*2;
    const start=positions.length/3;
    push(0,.36,0,1,1,.82);
    push(Math.cos(angle)*.085,.4,Math.sin(angle)*.085,1,1,1);
    push(Math.cos(angle+1.1)*.085,.4,Math.sin(angle+1.1)*.085,1,1,1);
    indices.push(start,start+1,start+2);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute("position",new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute("color",new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();
  return geometry;
}

export function createGrassMaterial(){
  const interaction:GrassInteraction={
    time:{value:0},
    player:{value:new THREE.Vector3(0,-100,0)},
    trail:{value:new THREE.Vector3(0,-100,0)},
    velocity:{value:new THREE.Vector3()},
  };
  // Folhagem fina recebe luz dos dois lados. Uma base não iluminada evita que
  // lâminas verticais virem silhuetas pretas quando o sol está baixo.
  const material=new THREE.MeshBasicMaterial({color:0xffffff,side:THREE.DoubleSide,vertexColors:true,fog:true,toneMapped:true});
  material.userData.grassInteraction=interaction;
  material.onBeforeCompile=shader=>{
    shader.uniforms.uGrassTime=interaction.time;
    shader.uniforms.uGrassPlayer=interaction.player;
    shader.uniforms.uGrassTrail=interaction.trail;
    shader.uniforms.uGrassVelocity=interaction.velocity;
    shader.vertexShader=shader.vertexShader.replace("#include <common>",`#include <common>
uniform float uGrassTime;
uniform vec3 uGrassPlayer;
uniform vec3 uGrassTrail;
uniform vec3 uGrassVelocity;`);
    shader.vertexShader=shader.vertexShader.replace("#include <project_vertex>",`vec4 mvPosition=vec4(transformed,1.0);
#ifdef USE_BATCHING
  mvPosition=batchingMatrix*mvPosition;
#endif
#ifdef USE_INSTANCING
  mvPosition=instanceMatrix*mvPosition;
  vec3 grassWorldPosition=(modelMatrix*instanceMatrix*vec4(0.0,0.0,0.0,1.0)).xyz;
  float grassTip=clamp(position.y,0.0,1.0);
  float grassFlex=grassTip*grassTip;
  float windPhase=uGrassTime*1.75+grassWorldPosition.x*0.16+grassWorldPosition.z*0.12;
  vec2 grassWind=vec2(sin(windPhase),cos(windPhase*0.83))*0.10;
  vec2 playerDelta=grassWorldPosition.xz-uGrassPlayer.xz;
  float playerDistance=length(playerDelta);
  float playerForce=(1.0-smoothstep(0.25,2.15,playerDistance))*(0.42+clamp(length(uGrassVelocity.xz)*0.075,0.0,0.58));
  vec2 trailDelta=grassWorldPosition.xz-uGrassTrail.xz;
  float trailDistance=length(trailDelta);
  float trailForce=(1.0-smoothstep(0.2,1.75,trailDistance))*0.46;
  vec2 playerDirection=normalize(playerDelta+vec2(0.0001));
  vec2 trailDirection=normalize(trailDelta+vec2(0.0001));
  mvPosition.xz+=(grassWind+playerDirection*playerForce+trailDirection*trailForce)*grassFlex;
#endif
mvPosition=modelViewMatrix*mvPosition;
gl_Position=projectionMatrix*mvPosition;`);
  };
  material.customProgramCacheKey=()=>"aurora-dynamic-grass-v1";
  return material;
}

export function createGrassField(
  tufts:Array<{x:number;y:number;z:number;rotation:number;height:number;width:number;tint:number}>,
  geometry:THREE.BufferGeometry,
  material:THREE.Material,
){
  const grass=new THREE.InstancedMesh(geometry,material,tufts.length);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  const axis=new THREE.Vector3(0,1,0),color=new THREE.Color();
  tufts.forEach((tuft,index)=>{
    position.set(tuft.x,tuft.y+.015,tuft.z);
    rotation.setFromAxisAngle(axis,tuft.rotation);
    scale.set(tuft.width,tuft.height,tuft.width);
    matrix.compose(position,rotation,scale);grass.setMatrixAt(index,matrix);
    color.setHSL(.25+tuft.tint*.05,.56+tuft.tint*.16,.4+tuft.tint*.12);grass.setColorAt(index,color);
  });
  grass.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  grass.instanceMatrix.needsUpdate=true;
  if(grass.instanceColor)grass.instanceColor.needsUpdate=true;
  grass.computeBoundingBox();grass.computeBoundingSphere();
  grass.castShadow=false;grass.receiveShadow=true;
  return grass;
}

const FLOWER_HUES=[0.02,0.09,0.78,0.58,0.13];

/** Flores esparsas nos tufos mais claros — pontos de cor que quebram o verde. */
export function createFlowerField(
  tufts:Array<{x:number;y:number;z:number;rotation:number;height:number;tint:number}>,
  geometry:THREE.BufferGeometry,
  material:THREE.Material,
){
  const chosen=tufts.filter((tuft,index)=>index%7===0&&tuft.tint>.62);
  if(!chosen.length)return null;
  const flowers=new THREE.InstancedMesh(geometry,material,chosen.length);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  const axis=new THREE.Vector3(0,1,0),color=new THREE.Color();
  chosen.forEach((tuft,index)=>{
    position.set(tuft.x,tuft.y+.01,tuft.z);
    rotation.setFromAxisAngle(axis,tuft.rotation);
    const size=.85+tuft.tint*.5;
    scale.set(size,size*(.9+tuft.height*.4),size);
    matrix.compose(position,rotation,scale);flowers.setMatrixAt(index,matrix);
    color.setHSL(FLOWER_HUES[index%FLOWER_HUES.length],.72,.66);flowers.setColorAt(index,color);
  });
  flowers.instanceMatrix.needsUpdate=true;
  if(flowers.instanceColor)flowers.instanceColor.needsUpdate=true;
  flowers.computeBoundingBox();flowers.computeBoundingSphere();
  flowers.castShadow=false;flowers.receiveShadow=false;
  return flowers;
}

export function updateGrassInteraction(material:THREE.Material,time:number,player:THREE.Vector3,trail:THREE.Vector3,velocity:THREE.Vector3){
  const interaction=material.userData.grassInteraction as GrassInteraction;
  interaction.time.value=time;interaction.player.value.copy(player);interaction.trail.value.copy(trail);interaction.velocity.value.copy(velocity);
}
