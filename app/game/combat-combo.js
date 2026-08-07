export function requestCombo({step,buffered,active,windowOpen}){
  if(active)return{step,buffered:Math.min(Math.max(0,3-step),buffered+1),startStep:0,windowOpen:false};
  const startStep=windowOpen&&step>0&&step<3?step+1:1;
  return{step:startStep,buffered,startStep,windowOpen:false};
}

export function finishCombo({step,buffered}){
  if(buffered>0&&step<3)return{step:step+1,buffered:buffered-1,startStep:step+1,windowOpen:false};
  return{step,buffered:0,startStep:0,windowOpen:true};
}
