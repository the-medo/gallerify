import * as THREE from 'three';
import { TPoint } from './types.ts';

export function calculateAngle(start: TPoint, end: TPoint): number {
  const startVec = new THREE.Vector2(start.x, start.y);
  const endVec = new THREE.Vector2(end.x, end.y);
  const directionVec = endVec.sub(startVec);

  let angleRad = directionVec.angle(); // Returns the angle in radians
  angleRad -= Math.PI / 2;

  return angleRad;
  // return (angleRad * 180) / Math.PI;
}
