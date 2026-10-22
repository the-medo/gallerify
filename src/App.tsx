import { useEffect } from 'react';
import GenerateBox from './components/GenerateBox/GenerateBox.tsx';
import Preview from './components/Preview/Preview.tsx';
import { useStore } from './store/store.ts';
import Turn3dBox from './components/GenerateBox/Turn3dBox.tsx';
import GalleryArtwork from './components/GalleryArtwork/GalleryArtwork.tsx';
import gallerifyMark from './assets/brand/gallerify-mark.png';
import PresetSelector from './components/PresetSelector/PresetSelector.tsx';

function App() {
  const setWindowWidth = useStore((state) => state.setWindowWidth);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [setWindowWidth]);

  return (
    <div className="app-shell">
      <div className="page-wrap">
        <header className="site-header">
          <a className="brand" href="#main" aria-label="Gallerify workspace">
            <img className="brand-mark" src={gallerifyMark} width="48" height="48" alt="" />
            <span>
              gallerify<span className="brand-dot">.</span>
            </span>
          </a>
          <span className="header-caption">Art deserves a place of its own.</span>
          <span className="studio-badge">
            <span className="status-dot" /> Gallery builder
          </span>
        </header>

        <main id="main">
          <section className="intro" aria-labelledby="page-title">
            <div className="intro-copy">
              <p className="eyebrow">
                <span className="eyebrow-line" /> A little space for a lot of expression
              </p>
              <h1 id="page-title">
                The art is yours. <em>So is the gallery.</em>
              </h1>
              <p className="intro-description">
                Turn a collection into a world of its own. Begin with a space that feels like you.
              </p>
            </div>
            <GalleryArtwork />
          </section>

          <div className="workspace-caption">
            <span>The gallery canvas</span>
            <span>A space for your collection</span>
          </div>
          <div className="workspace">
            <aside className="control-panel" aria-label="Layout controls">
              <GenerateBox />
              <Turn3dBox />
              <div className="studio-note">
                <span aria-hidden="true">✳</span>
                <p>
                  A space for your art.
                  <br />A reflection of you.
                </p>
              </div>
            </aside>
            <Preview />
          </div>
          <PresetSelector />
          <footer className="page-footer">
            <span>For the art you make. And the art you love.</span>
            <span>Gallerify / A home for art online</span>
          </footer>
        </main>
      </div>
    </div>
  );
}

export default App;
