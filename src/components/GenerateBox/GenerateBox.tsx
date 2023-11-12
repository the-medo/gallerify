import React, { CSSProperties } from 'react';
import {
  Box,
  Button,
  Card,
  Flex,
  Grid,
  /*Heading,*/
  LayoutProps,
  Separator,
  Slider,
  Text,
} from '@radix-ui/themes';
import { useStore } from '../../store/store.ts';
import { UpdateIcon } from '@radix-ui/react-icons';

export interface BoxPosition {
  left: LayoutProps['left'];
  top: LayoutProps['top'];
  css?: CSSProperties;
}

interface GenerateBoxProps {}

const GenerateBox: React.FC<GenerateBoxProps> = () => {
  const stepSize = useStore((state) => state.stepSize);
  const width = useStore((state) => state.width);
  const height = useStore((state) => state.height);
  const maxSize = useStore((state) => state.maxSize);

  const setStepSize = useStore((state) => state.setStepSize);
  const setWidth = useStore((state) => state.setWidth);
  const setHeight = useStore((state) => state.setHeight);
  const handleGenerate = useStore((state) => state.handleGenerate);

  return (
    <Box width="100%" px={'8'}>
      <Card style={{ height: '100%' }}>
        <Flex p={'3'} display={'flex'} gap={'3'} direction={'column'}>
          <Grid
            columns="3"
            gap="3"
            align="center"
            justify="end"
            style={{
              gridTemplateColumns: 'auto 150px auto',
            }}
          >
            <Box width="max-content">
              <Text align="right">Step size:</Text>
            </Box>
            <Slider onValueChange={setStepSize} step={1} value={[stepSize]} min={2} max={10} />
            <Box width="max-content">
              <Text align="left">{stepSize} meters</Text>
            </Box>

            <Separator style={{ gridColumnStart: 1, gridColumnEnd: 4 }} my="3" size="4" />

            <Box width="max-content">
              <Text align="right">Width:</Text>
            </Box>
            <Slider
              onValueChange={setWidth}
              value={[width]}
              step={stepSize}
              min={stepSize * 2}
              max={maxSize}
            />
            <Box width="max-content">
              <Text align="left">{width} meters</Text>
            </Box>

            <Box width="max-content">
              <Text align="right">Height:</Text>
            </Box>
            <Slider
              onValueChange={setHeight}
              value={[height]}
              step={stepSize}
              min={stepSize * 2}
              max={maxSize}
            />
            <Box width="max-content">
              <Text align="left">{height} meters</Text>
            </Box>
          </Grid>
          <Button onClick={handleGenerate}>
            <UpdateIcon />
            Generate
          </Button>
        </Flex>
      </Card>
    </Box>
  );
};

export default GenerateBox;
