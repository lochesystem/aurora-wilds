export function canStartClimb({rise,holding,moving,stamina,underground=false}){
  if(!holding||!moving||stamina<=0)return false;
  const minimum=underground?.45:.62,maximum=underground?3.8:4.2;
  return rise>=minimum&&rise<=maximum;
}

export function stepClimbStamina(stamina,dt,climbing){
  return Math.max(0,Math.min(100,stamina+(climbing?-18:12)*Math.max(0,dt)));
}

export function climbingLimbPose(time){
  const cycle=Math.sin(time*2.7);return{leftArm:-2.35+cycle*.42,rightArm:-2.35-cycle*.42,leftHip:.5-cycle*.34,rightHip:.5+cycle*.34,leftKnee:.72+cycle*.2,rightKnee:.72-cycle*.2};
}
