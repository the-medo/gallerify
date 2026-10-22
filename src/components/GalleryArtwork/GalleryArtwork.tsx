import curatorArtwork from '../../assets/artwork/curator.png';
import paletteArtwork from '../../assets/artwork/palette.png';

export default function GalleryArtwork() {
  return (
    <figure className="gallery-art" aria-label="Two abstract paintings, studies in color and form">
      <div className="art-card art-card-primary">
        <img
          src={curatorArtwork}
          alt="An abstract painting in oxblood, ochre, and ivory with expressive charcoal lines"
        />
        <span className="art-card-caption">
          Study in form <span>01</span>
        </span>
      </div>
      <div className="art-card art-card-secondary">
        <img
          src={paletteArtwork}
          alt="A colorful gouache collage with ultramarine, ochre, and olive shapes"
        />
        <span className="art-card-caption">
          Color, in conversation <span>02</span>
        </span>
      </div>
      <figcaption className="art-handnote">a place for your perspective</figcaption>
    </figure>
  );
}
