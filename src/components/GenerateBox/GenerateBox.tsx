import React, { CSSProperties, useMemo, useState } from 'react';
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

interface BoxPosition {
  left: LayoutProps['left'];
  top: LayoutProps['top'];
  css?: CSSProperties;
}

interface GenerateBoxProps {}

const DEFAULT_STEP = 5;
const DEFAULT_WIDTH = 15;
const DEFAULT_HEIGHT = 15;

const GenerateBox: React.FC<GenerateBoxProps> = () => {
  const [generated, setGenerated] = useState(false);
  const [step, setStep] = useState(DEFAULT_STEP);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [height, setHeight] = useState(DEFAULT_HEIGHT);
  const [maxSize, setMaxSize] = useState(50);

  const boxPosition: BoxPosition = useMemo(() => {
    if (generated) {
      return {
        left: '0',
        top: '0',
      };
    } else {
      return {
        left: '50%',
        top: '50%',
        css: {
          translate: '-50% -50%',
          scale: '1.5',
        },
      };
    }
  }, [generated]);

  const generateHandler = () => setGenerated(true);

  const onStepChange = (x: number[]) => {
    setStep(x[0]);
    setWidth((w) => Math.round(w / x[0]) * x[0]);
    setHeight((w) => Math.round(w / x[0]) * x[0]);
    setMaxSize((w) => Math.round(w / x[0]) * x[0]);
  };
  const onWidthChange = (x: number[]) => setWidth(x[0]);
  const onHeightChange = (x: number[]) => setHeight(x[0]);

  return (
    <Box
      position={'fixed'}
      left={boxPosition.left}
      top={boxPosition.top}
      style={{ transition: '0.2s ease-in', ...boxPosition.css }}
      p={'9'}
    >
      <Card style={{ height: '100%' }}>
        <Flex p={'3'} display={'flex'} gap={'3'} direction={'column'}>
          {/*<Heading size="8">Gallery layout</Heading>*/}

          <Grid
            columns="3"
            gap="3"
            align="center"
            justify="end"
            style={{
              gridTemplateColumns: 'auto 200px auto',
            }}
          >
            <Box width="max-content">
              <Text align="right">Step size:</Text>
            </Box>
            <Slider
              onValueChange={onStepChange}
              step={1}
              defaultValue={[DEFAULT_STEP]}
              min={2}
              max={10}
            />
            {/*<TextField.Input size="2" value={3} placeholder="Search the docs…" />*/}
            <Box width="max-content">
              <Text align="left">{step} meters</Text>
            </Box>

            <Separator style={{ gridColumnStart: 1, gridColumnEnd: 4 }} my="3" size="4" />

            <Box width="max-content">
              <Text align="right">Width:</Text>
            </Box>
            <Slider
              onValueChange={onWidthChange}
              value={[width]}
              step={step}
              min={step * 2}
              max={maxSize}
              defaultValue={[DEFAULT_WIDTH]}
            />
            <Box width="max-content">
              <Text align="left">{width} meters</Text>
            </Box>

            <Box width="max-content">
              <Text align="right">Height:</Text>
            </Box>
            <Slider
              onValueChange={onHeightChange}
              value={[height]}
              step={step}
              min={step * 2}
              max={maxSize}
              defaultValue={[DEFAULT_HEIGHT]}
            />
            <Box width="max-content">
              <Text align="left">{height} meters</Text>
            </Box>
          </Grid>
          <Button onClick={generateHandler}>Generate</Button>
        </Flex>
      </Card>
    </Box>
  );
};

export default GenerateBox;
