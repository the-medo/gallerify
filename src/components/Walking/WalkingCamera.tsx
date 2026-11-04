import { useEffect, useMemo, useRef } from 'react';
import type { MutableRefObject } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '../../store/store.ts';
import {
  createWalkSpace,
  EYE_HEIGHT,
  getWalkEntrance,
  moveWalker,
  WALK_SPEED,
} from '../../utils/walking.ts';

export type WalkDirection = 'forward' | 'backward' | 'left' | 'right';
export type WalkInput = MutableRefObject<Set<WalkDirection>>;

const movementKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'KeyQ',
  'KeyE',
]);

export default function WalkingCamera({
  input,
  restart,
  onReady,
}: {
  input: WalkInput;
  restart: number;
  onReady: () => void;
}) {
  const camera = useThree((state) => state.camera);
  const canvas = useThree((state) => state.gl.domElement);
  const walls = useStore((state) => state.walls);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const stepSize = useStore((state) => state.stepSize);
  const space = useMemo(() => createWalkSpace(walls, width, height), [walls, width, height]);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: 0 });

  useEffect(() => {
    const entrance = getWalkEntrance(space, stepSize);
    camera.position.set(entrance.x, EYE_HEIGHT, entrance.z);
    camera.rotation.set(0, 0, 0, 'YXZ');
    look.current = { yaw: 0, pitch: 0 };
    keys.current.clear();
    input.current.clear();
    onReady();
  }, [camera, space, stepSize, restart, input, onReady]);

  useEffect(() => {
    let drag: { id: number; x: number; y: number } | null = null;
    const clearInput = () => {
      keys.current.clear();
      input.current.clear();
      drag = null;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (!movementKeys.has(event.code) || event.ctrlKey || event.metaKey || event.altKey) return;
      event.preventDefault();
      keys.current.add(event.code);
    };
    const onKeyUp = (event: KeyboardEvent) => keys.current.delete(event.code);
    const turn = (dx: number, dy: number) => {
      look.current.yaw -= dx * 0.0025;
      look.current.pitch = Math.max(-1.3, Math.min(1.3, look.current.pitch - dy * 0.0025));
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || document.pointerLockElement === canvas || drag) return;
      canvas.setPointerCapture(event.pointerId);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return;
      turn(event.clientX - drag.x, event.clientY - drag.y);
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
    };
    const onPointerUp = (event: PointerEvent) => {
      if (drag?.id === event.pointerId) drag = null;
    };
    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement === canvas) turn(event.movementX, event.movementY);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', clearInput);
    document.addEventListener('visibilitychange', clearInput);
    document.addEventListener('pointerlockchange', clearInput);
    document.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('lostpointercapture', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
    return () => {
      clearInput();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', clearInput);
      document.removeEventListener('visibilitychange', clearInput);
      document.removeEventListener('pointerlockchange', clearInput);
      document.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('lostpointercapture', onPointerUp);
      canvas.removeEventListener('pointercancel', onPointerUp);
    };
  }, [canvas, input]);

  useFrame((_, delta) => {
    const elapsed = Math.min(delta, 0.05);
    const pressed = (...codes: string[]) => codes.some((code) => keys.current.has(code));
    const forward =
      Number(pressed('KeyW', 'ArrowUp') || input.current.has('forward')) -
      Number(pressed('KeyS', 'ArrowDown') || input.current.has('backward'));
    const right =
      Number(pressed('KeyD', 'ArrowRight') || input.current.has('right')) -
      Number(pressed('KeyA', 'ArrowLeft') || input.current.has('left'));
    look.current.yaw += (Number(pressed('KeyQ')) - Number(pressed('KeyE'))) * elapsed * 1.6;
    const { yaw, pitch } = look.current;
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    if (!forward && !right) return;
    const distance = (WALK_SPEED * elapsed) / Math.hypot(forward, right);
    const next = moveWalker(
      camera.position,
      {
        x: (right * Math.cos(yaw) - forward * Math.sin(yaw)) * distance,
        z: (-forward * Math.cos(yaw) - right * Math.sin(yaw)) * distance,
      },
      space,
    );
    camera.position.set(next.x, EYE_HEIGHT, next.z);
  });

  return null;
}
