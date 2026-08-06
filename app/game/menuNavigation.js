export function gamepadMenuDirection(axes,buttons,threshold=.58){
  if(buttons[12])return "up";
  if(buttons[13])return "down";
  if(buttons[14])return "left";
  if(buttons[15])return "right";
  const x=axes[0]??0,y=axes[1]??0;if(Math.max(Math.abs(x),Math.abs(y))<threshold)return null;
  return Math.abs(x)>Math.abs(y)?x<0?"left":"right":y<0?"up":"down";
}

export function findNextSpatialIndex(rects,currentIndex,direction){
  if(!rects.length)return -1;if(currentIndex<0||currentIndex>=rects.length)return 0;
  const current=rects[currentIndex],cx=current.left+current.width/2,cy=current.top+current.height/2;let best=-1,bestScore=Infinity;
  rects.forEach((rect,index)=>{if(index===currentIndex)return;const x=rect.left+rect.width/2-cx,y=rect.top+rect.height/2-cy;const primary=direction==="left"?-x:direction==="right"?x:direction==="up"?-y:y;if(primary<=2)return;const perpendicular=direction==="left"||direction==="right"?Math.abs(y):Math.abs(x),score=primary+perpendicular*1.65+(perpendicular>primary*2?perpendicular:0);if(score<bestScore){best=index;bestScore=score}});
  return best;
}
