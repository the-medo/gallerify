import { useState } from 'react';
import { CheckIcon } from '@radix-ui/react-icons';
import { useStore } from '../../store/store.ts';
import { createPresetLayout, galleryPresets, PRESET_SIZES } from '../../presets/galleryPresets.ts';
import type { GalleryPreset, PresetSize } from '../../presets/galleryPresets.ts';
import './presets.css';

// Use the same geometry as the live preview; the thumbnail is always the real plan.
const thumbnails = new Map(
  galleryPresets.map((preset) => [
    preset.id,
    Object.values(createPresetLayout(preset).rooms).flatMap((room) => room.walls),
  ]),
);

function FloorPlan({ preset }: { preset: GalleryPreset }) {
  return (
    <svg
      className="preset-plan"
      viewBox={`-2 -2 ${preset.width + 4} ${preset.height + 4}`}
      aria-hidden="true"
    >
      <rect width={preset.width} height={preset.height} className="preset-floor" />
      {thumbnails.get(preset.id)!.map((wall) => (
        <line
          key={wall.id}
          x1={wall.line.start.x}
          y1={wall.line.start.y}
          x2={wall.line.end.x}
          y2={wall.line.end.y}
        />
      ))}
      <path
        className="preset-entrance"
        d={`M ${preset.width / 2} ${preset.height + 1.7} v -1.5 m -0.6 0.6 l 0.6 -0.6 l 0.6 0.6`}
      />
    </svg>
  );
}

export default function PresetSelector() {
  const activePresetId = useStore((state) => state.activePresetId);
  const loadPreset = useStore((state) => state.loadPreset);
  const [size, setSize] = useState<PresetSize>(
    () => galleryPresets.find((preset) => preset.id === activePresetId)?.size ?? 'Medium',
  );
  const presets = galleryPresets.filter((preset) => preset.size === size);
  const activePreset = galleryPresets.find((preset) => preset.id === activePresetId);

  return (
    <section className="presets-section" aria-labelledby="presets-title">
      <div className="presets-heading">
        <div>
          <p className="section-kicker">
            The starting collection <span>/ 20 presets</span>
          </p>
          <h2 id="presets-title">A space for every collection.</h2>
          <p className="presets-description">
            From a quiet corner to a grand exhibition. Choose a plan, then make it yours.
          </p>
        </div>
        <div className="preset-filters" role="group" aria-label="Preset size">
          {PRESET_SIZES.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={size === option}
              onClick={() => setSize(option)}
            >
              {option} <span>05</span>
            </button>
          ))}
        </div>
      </div>
      <div className="preset-cards" key={size} role="group" aria-label={`${size} gallery presets`}>
        {presets.map((preset) => {
          const selected = activePresetId === preset.id;
          return (
            <button
              className="preset-card"
              key={preset.id}
              type="button"
              aria-pressed={selected}
              aria-label={`Load ${preset.name}, ${preset.width} by ${preset.height} meters`}
              onClick={() => loadPreset(preset.id)}
            >
              <span className="preset-card-top">
                <span>{String(galleryPresets.indexOf(preset) + 1).padStart(2, '0')}</span>
                <span>
                  {selected ? (
                    <>
                      <CheckIcon /> In canvas
                    </>
                  ) : (
                    `${preset.width * preset.height} m²`
                  )}
                </span>
              </span>
              <FloorPlan preset={preset} />
              <span className="preset-name">{preset.name}</span>
              <span className="preset-dimensions">
                {preset.width} × {preset.height} m <span>↗</span>
              </span>
              <span className="preset-description">{preset.description}</span>
            </button>
          );
        })}
      </div>
      <div className="presets-footer">
        <span aria-live="polite">
          {activePreset
            ? `${activePreset.name} is in your canvas.`
            : 'Your generated layout is in the canvas.'}
        </span>
        <span>Switching plans resets walls and finishes.</span>
      </div>
    </section>
  );
}
