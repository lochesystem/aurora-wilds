export const DAY_SECONDS=8*60;
export const NIGHT_SECONDS=4*60;
export const WORLD_CYCLE_SECONDS=DAY_SECONDS+NIGHT_SECONDS;

const DAY_START_MINUTES=7*60;
const NIGHT_START_MINUTES=18*60;
const NIGHT_CLOCK_MINUTES=24*60-NIGHT_START_MINUTES+DAY_START_MINUTES;

export function worldTimeAt(elapsedSeconds){
  const elapsed=((elapsedSeconds%WORLD_CYCLE_SECONDS)+WORLD_CYCLE_SECONDS)%WORLD_CYCLE_SECONDS;
  const isNight=elapsed>=DAY_SECONDS;
  const totalMinutes=isNight
    ? (NIGHT_START_MINUTES+(elapsed-DAY_SECONDS)/NIGHT_SECONDS*NIGHT_CLOCK_MINUTES)%(24*60)
    : DAY_START_MINUTES+elapsed/DAY_SECONDS*(NIGHT_START_MINUTES-DAY_START_MINUTES);
  const roundedMinutes=Math.floor(totalMinutes);
  const hours=String(Math.floor(roundedMinutes/60)).padStart(2,"0");
  const minutes=String(roundedMinutes%60).padStart(2,"0");
  return{fraction:totalMinutes/(24*60),isNight,timeLabel:`${hours}:${minutes}`};
}

export function nextDawnAt(elapsedSeconds){
  const elapsed=((elapsedSeconds%WORLD_CYCLE_SECONDS)+WORLD_CYCLE_SECONDS)%WORLD_CYCLE_SECONDS;
  if(elapsed<DAY_SECONDS)return elapsedSeconds;
  return elapsedSeconds+(WORLD_CYCLE_SECONDS-elapsed);
}
