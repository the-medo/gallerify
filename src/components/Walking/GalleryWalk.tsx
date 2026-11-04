import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Cross2Icon, ResetIcon } from '@radix-ui/react-icons';
import { useStore } from '../../store/store.ts';
import Base3d from '../Canvas/3D/Base3d.tsx';
import Wall3d from '../Canvas/3D/Wall3d.tsx';
import WalkingCamera from './WalkingCamera.tsx';
import type { WalkDirection } from './WalkingCamera.tsx';
import './walking.css';

const directions: { direction: WalkDirection; label: string; symbol: string }[] = [
  { direction: 'forward', label: 'Walk forward', symbol: '↑' },
  { direction: 'left', label: 'Walk left', symbol: '←' },
  { direction: 'backward', label: 'Walk backward', symbol: '↓' },
  { direction: 'right', label: 'Walk right', symbol: '→' },
];

export default function GalleryWalk({ name, onExit }: { name: string; onExit: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const input = useRef(new Set<WalkDirection>());
  const walls = useStore((state) => state.walls);
  const [restart, setRestart] = useState(0);
  const [ready, setReady] = useState(false);
  const [mouseLook, setMouseLook] = useState(false);
  const [mouseLookError, setMouseLookError] = useState(false);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    const modal = dialog.current!;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    modal.showModal();
    exitButton.current?.focus();
    const onLockChange = () => setMouseLook(document.pointerLockElement === canvas.current);
    const onLockError = () => setMouseLookError(true);
    document.addEventListener('pointerlockchange', onLockChange);
    document.addEventListener('pointerlockerror', onLockError);
    return () => {
      if (document.pointerLockElement === canvas.current) document.exitPointerLock();
      document.removeEventListener('pointerlockchange', onLockChange);
      document.removeEventListener('pointerlockerror', onLockError);
      document.body.style.overflow = previousOverflow;
      modal.close();
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  const enableMouseLook = async () => {
    setMouseLookError(false);
    try {
      if (!canvas.current?.requestPointerLock) throw new Error('Mouse capture unavailable');
      await canvas.current.requestPointerLock();
    } catch {
      setMouseLookError(true);
    }
  };

  return (
    <dialog
      className="gallery-walk"
      ref={dialog}
      aria-labelledby="walk-title"
      aria-describedby="walk-instructions"
      onCancel={(event) => {
        event.preventDefault();
        onExit();
      }}
    >
      <div className="walk-scene" aria-label="First-person gallery view">
        <Canvas
          shadows
          camera={{ fov: 70, near: 0.05, far: 150 }}
          dpr={[1, 2]}
          onCreated={({ gl }) => {
            canvas.current = gl.domElement;
          }}
        >
          <color attach="background" args={['#eae2d2']} />
          <hemisphereLight args={['#fffaf0', '#b7a58a', 2.4]} />
          <directionalLight position={[4, 8, 3]} intensity={1.2} />
          <Suspense fallback={null}>
            <Base3d />
            {Object.keys(walls).map((wallId) => (
              <Wall3d key={wallId} wallId={wallId} interactive={false} />
            ))}
            <WalkingCamera input={input} restart={restart} onReady={onReady} />
          </Suspense>
        </Canvas>
      </div>

      <header className="walk-toolbar">
        <div className="walk-title">
          <span className="status-dot" />
          <div>
            <span className="walk-eyebrow">Inside your gallery</span>
            <h2 id="walk-title">{name}</h2>
          </div>
        </div>
        <div className="walk-actions">
          <button
            type="button"
            className="walk-restart"
            onClick={() => setRestart((value) => value + 1)}
            disabled={!ready}
          >
            <ResetIcon /> Back to entrance
          </button>
          <button type="button" onClick={onExit} ref={exitButton}>
            <Cross2Icon /> Exit
          </button>
        </div>
      </header>

      {!ready && (
        <div className="walk-loading" role="status">
          Opening your gallery…
        </div>
      )}
      {ready && <div className="walk-crosshair" aria-hidden="true" />}

      <footer className="walk-help" id="walk-instructions">
        <p className="walk-desktop-help">
          <strong>WASD / arrows</strong> to walk <span>·</span> Drag to look <span>·</span> Q / E to
          turn
        </p>
        <p className="walk-touch-help">Hold an arrow to walk. Drag the view to look around.</p>
        <div className="walk-mouse-help">
          <button type="button" disabled={!ready || mouseLook} onClick={enableMouseLook}>
            {mouseLook ? 'Mouse look on · Esc to release' : 'Enable mouse look'}
          </button>
          <span role="status">
            {mouseLookError
              ? 'Mouse capture unavailable. Drag to look instead.'
              : 'Explore at your own pace.'}
          </span>
        </div>
      </footer>

      <div className="walk-touch-controls" role="group" aria-label="Walking controls">
        {directions.map(({ direction, label, symbol }) => (
          <button
            key={direction}
            type="button"
            className={`walk-${direction}`}
            aria-label={label}
            disabled={!ready}
            onPointerDown={(event) => {
              event.preventDefault();
              event.currentTarget.setPointerCapture(event.pointerId);
              input.current.add(direction);
            }}
            onPointerUp={() => input.current.delete(direction)}
            onPointerCancel={() => input.current.delete(direction)}
            onLostPointerCapture={() => input.current.delete(direction)}
          >
            {symbol}
          </button>
        ))}
      </div>
    </dialog>
  );
}
