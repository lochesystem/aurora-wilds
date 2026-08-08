export function moveGridSelection(current,count,columns,direction){
  if(count<=0)return 0;
  const index=Math.max(0,Math.min(count-1,current)),width=Math.max(1,columns),row=Math.floor(index/width),column=index%width;
  if(direction==="left")return column>0?index-1:index;
  if(direction==="right")return column<width-1&&index+1<count?index+1:index;
  if(direction==="up")return row>0?index-width:index;
  if(direction==="down")return Math.min(count-1,index+width);
  return index;
}
