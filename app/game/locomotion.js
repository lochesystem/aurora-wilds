const clamp01=value=>Math.max(0,Math.min(1,value));

export function locomotionPose(time,speed,running){
  const motion=clamp01(speed/4.5);
  const cadence=running?1.78:1.15;
  const cycle=Math.sin(time*cadence);
  const stride=cycle*motion;
  const strideScale=running?.96:.72;
  const kneeScale=running?.94:.62;
  const armScale=running?.7:.42;
  const doubleStep=Math.abs(Math.sin(time*cadence*2));

  return{
    motion,
    cadence,
    leftHip:stride*strideScale,
    rightHip:-stride*strideScale,
    // A flexão positiva leva a canela para trás. O sinal negativo hiperestendia o joelho.
    leftKnee:.08+Math.max(0,-stride)*kneeScale,
    rightKnee:.08+Math.max(0,stride)*kneeScale,
    leftArm:-stride*armScale,
    rightArm:stride*armScale,
    leftElbow:-.12-Math.max(0,stride)*(running?.34:.15),
    rightElbow:-.12-Math.max(0,-stride)*(running?.34:.15),
    bodyLean:running?motion*.13:0,
    bodyTwist:stride*(running?.09:.035),
    bodyRoll:cycle*motion*(running?.045:.025),
    bodyBob:doubleStep*motion*(running?.045:.018),
    headBob:doubleStep*motion*(running?.032:.025),
  };
}
