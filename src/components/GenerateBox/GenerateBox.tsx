import { CSSProperties } from 'react';
import { UpdateIcon } from '@radix-ui/react-icons';
import { useStore } from '../../store/store.ts';

interface DimensionControlProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number[]) => void;
}

function DimensionControl({ id, label, value, min, max, step, onChange }: DimensionControlProps) {
  return (
    <div className="dimension-control">
      <label htmlFor={id}>
        <span>{label}</span>
        <span className="dimension-value">
          {value}
          <small>m</small>
        </span>
      </label>
      <input
        id={id}
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange([Number(event.target.value)])}
        style={{ '--range-progress': `${((value - min) / (max - min)) * 100}%` } as CSSProperties}
        aria-valuetext={`${value} meters`}
      />
      <div className="range-limits" aria-hidden="true">
        <span>{min} m</span>
        <span>{max} m</span>
      </div>
    </div>
  );
}

export default function GenerateBox() {
  const { generatorSettings, maxSize, setStepSize, setWidth, setHeight, handleGenerate } =
    useStore();
  const { stepSize, width, height } = generatorSettings;
  return (
    <section className="dimensions-section" aria-labelledby="dimensions-title">
      <div className="section-kicker">
        <span>01</span> The generator
      </div>
      <h2 id="dimensions-title">Shape your gallery.</h2>
      <p className="section-description">
        Want a surprise? Set your dimensions, then generate a new layout.
      </p>
      <div className="dimension-fields">
        <DimensionControl
          id="step-size"
          label="Step size"
          value={stepSize}
          min={2}
          max={10}
          step={1}
          onChange={setStepSize}
        />
        <DimensionControl
          id="room-width"
          label="Width"
          value={width}
          min={stepSize * 2}
          max={maxSize}
          step={stepSize}
          onChange={setWidth}
        />
        <DimensionControl
          id="room-height"
          label="Height"
          value={height}
          min={stepSize * 2}
          max={maxSize}
          step={stepSize}
          onChange={setHeight}
        />
      </div>
      <button className="generate-button" type="button" onClick={handleGenerate}>
        <UpdateIcon width={18} height={18} /> Generate a layout{' '}
        <span className="button-arrow" aria-hidden="true">
          ↗
        </span>
      </button>
      <p className="generate-caption">A fresh layout every time. Presets are always here.</p>
    </section>
  );
}
