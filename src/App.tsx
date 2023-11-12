import { Box, Flex, Theme } from '@radix-ui/themes';
import Background from './components/Background/Background.tsx';
import Header from './components/Header/Header.tsx';
import GenerateBox from './components/GenerateBox/GenerateBox.tsx';
import Preview from './components/Preview/Preview.tsx';
import { useEffect } from 'react';
import { useStore } from './store/store.ts';

function App() {
  const setWindowWidth = useStore((state) => state.setWindowWidth);

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    handleResize();

    return () => window.removeEventListener('resize', handleResize);
  }, [setWindowWidth]);

  return (
    <Theme appearance="light" accentColor="brown" radius="full">
      <Background />
      <Flex
        direction={{ initial: 'column', md: 'row' }}
        align={{ initial: 'center', md: 'center' }}
        justify={{ initial: 'center', md: 'start' }}
        grow={'1'}
      >
        <Flex direction={'column'}>
          <Header />
          <GenerateBox />
        </Flex>
        <Box>
          <Preview />
        </Box>
      </Flex>
    </Theme>
  );
}

export default App;
