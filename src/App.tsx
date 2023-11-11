import { Theme, ThemePanel } from '@radix-ui/themes';
import Background from './components/Background/Background.tsx';
import Header from './components/Header/Header.tsx';
import GenerateBox from './components/GenerateBox/GenerateBox.tsx';

function App() {
  return (
    <Theme appearance="light" accentColor="iris" radius="full">
      <Background />
      <Header />
      <GenerateBox />
      <ThemePanel />
    </Theme>
  );
}

export default App;
