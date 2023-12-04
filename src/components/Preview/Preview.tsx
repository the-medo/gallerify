import React from 'react';
import { Box } from '@radix-ui/themes';
import { useStore } from '../../store/store.ts';
import Preview2d from './Preview2d.tsx';
import Preview3d from './Preview3d.tsx';
import TextureSelector from '../TextureSelector/TextureSelector.tsx';

interface PreviewProps {}

const Preview: React.FC<PreviewProps> = () => {
  const previewMode = useStore((state) => state.previewMode);

  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const squareSize = useStore((state) => state.squareSize);

  return (
    <Box p="3">
      <Box
        style={{
          width: width * squareSize + 10 + 'px',
          height: height * squareSize + 10 + 'px',
          border: '5px solid var(--accent-11)',
        }}
      >
        {previewMode === '2d' && <Preview2d />}
        {previewMode === '3d' && (
          <>
            <Preview3d />
            <TextureSelector />
          </>
        )}
      </Box>
    </Box>
  );
};

export default Preview;
