import { Box, Button, Card, Flex } from '@radix-ui/themes';
import React from 'react';
import { useStore } from '../../store/store.ts';

interface Turn3dBoxProps {}

const Turn3dBox: React.FC<Turn3dBoxProps> = () => {
  const generated = useStore((state) => state.generated);
  const previewMode = useStore((state) => state.previewMode);
  const setPreviewMode = useStore((state) => state.setPreviewMode);

  return (
    <Box width="100%" px={'8'}>
      <Card>
        <Flex p={'3'} display={'flex'} gap={'3'} direction={'column'}>
          <Button
            onClick={() => setPreviewMode(previewMode === '2d' ? '3d' : '2d')}
            disabled={!generated}
          >
            {previewMode === '2d' ? 'Preview in 3D' : 'Back to 2D'}
          </Button>
        </Flex>
      </Card>
    </Box>
  );
};

export default Turn3dBox;
