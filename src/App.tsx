import { Theme, ThemePanel } from '@radix-ui/themes';
import Background from './components/Background/Background.tsx';
import Header from './components/Header/Header.tsx';
import GenerateBox from './components/GenerateBox/GenerateBox.tsx';
import Preview from './components/Preview/Preview.tsx';

function App() {
  return (
    <Theme appearance="light" accentColor="brown" radius="full">
      <Background />
      <Header />
      <GenerateBox />
      <Preview />
      <ThemePanel />
    </Theme>
  );
}

export default App;
