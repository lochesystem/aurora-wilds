export function landingInstability(impactSpeed,horizontalSpeed){
  if(impactSpeed<6)return 0;
  return Math.min(.78,Math.max(0,(impactSpeed-6)*.075+horizontalSpeed*.032));
}

export function movementResponse(grounded,balancing){
  if(!grounded)return {acceleration:6.8,drag:.24,maxSpeed:5.65};
  if(balancing)return {acceleration:11,drag:3,maxSpeed:5.8};
  return {acceleration:24,drag:4.4,maxSpeed:7};
}

export function stepPlanarVelocity(current,input,dt,grounded,balancing,speedMultiplier=1){
  const response=movementResponse(grounded,balancing),inputLength=Math.hypot(input.x,input.z);
  if(inputLength>.001){
    const strength=Math.min(1,inputLength),maxSpeed=response.maxSpeed*Math.max(0,speedMultiplier),target={x:input.x/inputLength*maxSpeed*strength,z:input.z/inputLength*maxSpeed*strength};
    const delta={x:target.x-current.x,z:target.z-current.z},deltaLength=Math.hypot(delta.x,delta.z),currentLength=Math.hypot(current.x,current.z);let steering=1;
    if(currentLength>.1){const alignment=(current.x*target.x+current.z*target.z)/(currentLength*Math.max(.001,Math.hypot(target.x,target.z)));if(alignment<-.2)steering=.72;else if(alignment<.45)steering=.86}
    const maxChange=response.acceleration*steering*Math.max(0,dt);if(deltaLength<=maxChange)return target;
    return {x:current.x+delta.x/deltaLength*maxChange,z:current.z+delta.z/deltaLength*maxChange};
  }
  const coast=Math.exp(-response.drag*Math.max(0,dt));return {x:current.x*coast,z:current.z*coast};
}

export function lerpAngle(current,target,alpha){
  const fullTurn=Math.PI*2;
  const delta=((target-current+Math.PI)%fullTurn+fullTurn)%fullTurn-Math.PI;
  const next=current+delta*Math.max(0,Math.min(1,alpha));
  return Math.atan2(Math.sin(next),Math.cos(next));
}
