import React, { useMemo } from 'react';
import { Box } from '@radix-ui/themes';
import { useStore } from '../../store/store.ts';
import { BoxPosition } from '../GenerateBox/GenerateBox.tsx';

const DEFAULT_MULTIPLY = 8;

interface PreviewProps {}

const Preview: React.FC<PreviewProps> = () => {
  const generated = useStore((state) => state.generated);
  const stepSize = useStore((state) => state.stepSize);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);

  const boxPosition: BoxPosition = useMemo(() => {
    if (generated) {
      return {
        left: '50%',
        top: '50%',
        css: {
          translate: '-50% -50%',
          scale: '1.5',
        },
      };
    } else {
      return {
        left: '50%',
        top: '50%',
        css: {
          translate: '-50% 100px',
          scale: '1',
        },
      };
    }
  }, [generated]);

  return (
    <Box
      p="1"
      position={'fixed'}
      left={boxPosition.left}
      top={boxPosition.top}
      style={{
        width: width * DEFAULT_MULTIPLY + DEFAULT_MULTIPLY + 'px',
        height: height * DEFAULT_MULTIPLY + DEFAULT_MULTIPLY + 'px',
        border: '2px solid var(--accent-5)',
        transition: '0.2s ease-in',
        ...boxPosition.css,
      }}
    >
      <Box
        style={{
          width: '100%',
          height: '100%',
          border: '2px solid var(--accent-6)',
          // ...boxPosition.css,
        }}
      >
        asdf
      </Box>
    </Box>
  );
};

export default Preview;
