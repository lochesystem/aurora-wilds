/**
 * Coleta por cilindro, mais tolerante que uma esfera única: aproximar-se pela
 * lateral ou atravessar a moeda durante um salto continua contando.
 */
export function coinWithinPickup(player, coin) {
  const horizontal = Math.hypot(player.x - coin.x, player.z - coin.z);
  const vertical = Math.abs(player.y - coin.y);
  return horizontal <= 1.25 && vertical <= 1.35;
}

/**
 * Distingue contato por cima de contato lateral usando a altura dos pés.
 * O limite de velocidade positivo aceita pousos próximos ao ápice do salto,
 * quando a gravidade ainda não produziu uma velocidade negativa expressiva.
 */
export function classifyEnemyContact({
  horizontalDistance,
  playerFeetY,
  enemyTopY,
  verticalVelocity,
}) {
  if (horizontalDistance > 1.05) return "none";
  const feetFromTop = playerFeetY - enemyTopY;
  if (verticalVelocity <= 1.5 && feetFromTop >= -.36) return "stomp";
  if (feetFromTop >= -1.65 && feetFromTop < -.36) return "hurt";
  return "none";
}

/**
 * Retorna em qual fração do deslocamento um segmento toca uma esfera.
 * Isso evita tunneling quando um projétil cruza o alvo entre dois frames.
 */
export function segmentSphereHitFraction(start, end, center, radius) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const dz = end.z - start.z;
  const ox = start.x - center.x;
  const oy = start.y - center.y;
  const oz = start.z - center.z;
  const a = dx * dx + dy * dy + dz * dz;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  if (c <= 0) return 0;
  if (a <= Number.EPSILON) return null;
  const b = 2 * (ox * dx + oy * dy + oz * dz);
  const discriminant = b * b - 4 * a * c;
  if (discriminant < 0) return null;
  const hit = (-b - Math.sqrt(discriminant)) / (2 * a);
  return hit >= 0 && hit <= 1 ? hit : null;
}
