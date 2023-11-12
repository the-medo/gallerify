import React, { useMemo } from 'react';
import { useStore } from '../../../store/store.ts';
import { createBase } from '../../../compute/createBase.ts';
import Line from './Line.tsx';
import Point from './Point.tsx';

interface BaseProps {}

const Base: React.FC<BaseProps> = () => {
  const stepSize = useStore((state) => state.stepSize);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  const grid = useMemo(() => createBase({ width, height, stepSize }), [width, height, stepSize]);

  return (
    <>
      {Object.keys(grid.lines).map((lineKey) => (
        <Line key={lineKey} line={grid.lines[lineKey]} />
      ))}
      {Object.keys(grid.points).map((pointKey) => (
        <Point key={pointKey} point={grid.points[pointKey]} />
      ))}
    </>
  );
};

export default Base;
