const clamp=value=>Math.max(-1,Math.min(1,value));

export function minimapPosition(x,z,range=60){
  return{left:50+clamp(x/range)*43,top:50+clamp(z/range)*43};
}

export function minimapHeading(heading){
  return Math.PI-heading;
}
