import { wallKeyFromLine } from '../utils/types.ts';
import type { TRoomLayout, TWall } from '../utils/types.ts';

export const PRESET_SIZES = ['Small', 'Medium', 'Large', 'Grand'] as const;
export type PresetSize = (typeof PRESET_SIZES)[number];

// Coordinates are in grid modules, each stepSize meters wide. Long walls are
// split into modules so every corner and T-junction uses the renderer's geometry.
type WallSpan = readonly [x1: number, y1: number, x2: number, y2: number];

export type GalleryPreset = {
  id: string;
  name: string;
  description: string;
  size: PresetSize;
  width: number;
  height: number;
  stepSize: number;
  interiorWalls: readonly WallSpan[];
};

export const galleryPresets: readonly GalleryPreset[] = [
  {
    id: 'pocket',
    name: 'Pocket Gallery',
    size: 'Small',
    width: 6,
    height: 6,
    stepSize: 2,
    description: 'One quiet room. A single wall for a standout piece.',
    interiorWalls: [[1, 1, 1, 2]],
  },
  {
    id: 'alcove',
    name: 'The Alcove',
    size: 'Small',
    width: 8,
    height: 6,
    stepSize: 2,
    description: 'Two tucked-away corners for intimate discoveries.',
    interiorWalls: [
      [1, 0, 1, 1],
      [3, 2, 4, 2],
    ],
  },
  {
    id: 'twin-rooms',
    name: 'Twin Rooms',
    size: 'Small',
    width: 8,
    height: 8,
    stepSize: 2,
    description: 'A pair of connected rooms for a two-part collection.',
    interiorWalls: [
      [2, 0, 2, 1],
      [2, 2, 2, 4],
    ],
  },
  {
    id: 'corner-studio',
    name: 'Corner Studio',
    size: 'Small',
    width: 10,
    height: 8,
    stepSize: 2,
    description: 'An L-shaped partition frames a room within the room.',
    interiorWalls: [
      [2, 0, 2, 2],
      [2, 2, 4, 2],
    ],
  },
  {
    id: 'ribbon',
    name: 'The Ribbon',
    size: 'Small',
    width: 12,
    height: 6,
    stepSize: 2,
    description: 'A gentle back-and-forth route through a narrow space.',
    interiorWalls: [
      [2, 0, 2, 2],
      [4, 1, 4, 3],
    ],
  },
  {
    id: 'salon',
    name: 'The Salon',
    size: 'Medium',
    width: 12,
    height: 9,
    stepSize: 3,
    description: 'Four display bays open onto a generous central room.',
    interiorWalls: [
      [1, 0, 1, 1],
      [3, 0, 3, 1],
      [1, 2, 1, 3],
      [3, 2, 3, 3],
    ],
  },
  {
    id: 'sculpture-court',
    name: 'Sculpture Court',
    size: 'Medium',
    width: 12,
    height: 12,
    stepSize: 3,
    description: 'A sheltered centerpiece with a walk all the way around.',
    interiorWalls: [
      [1, 1, 3, 1],
      [1, 1, 1, 3],
      [3, 1, 3, 3],
    ],
  },
  {
    id: 'enfilade',
    name: 'The Enfilade',
    size: 'Medium',
    width: 18,
    height: 9,
    stepSize: 3,
    description: 'Three galleries linked by a single, uninterrupted sightline.',
    interiorWalls: [
      [2, 0, 2, 1],
      [2, 2, 2, 3],
      [4, 0, 4, 1],
      [4, 2, 4, 3],
    ],
  },
  {
    id: 'crossroads',
    name: 'Crossroads',
    size: 'Medium',
    width: 15,
    height: 12,
    stepSize: 3,
    description: 'A central passage connects four distinct exhibition corners.',
    interiorWalls: [
      [0, 2, 2, 2],
      [3, 2, 5, 2],
      [2, 0, 2, 1],
      [3, 0, 3, 1],
      [2, 3, 2, 4],
      [3, 3, 3, 4],
    ],
  },
  {
    id: 'atelier',
    name: 'The Atelier',
    size: 'Medium',
    width: 16,
    height: 10,
    stepSize: 2,
    description: 'Small side studios flank an open space for larger works.',
    interiorWalls: [
      [2, 0, 2, 2],
      [2, 3, 2, 5],
      [6, 0, 6, 2],
      [6, 3, 6, 5],
      [0, 2, 1, 2],
      [7, 2, 8, 2],
    ],
  },
  {
    id: 'promenade',
    name: 'The Promenade',
    size: 'Large',
    width: 24,
    height: 9,
    stepSize: 3,
    description: 'Alternating walls turn a long hall into a leisurely journey.',
    interiorWalls: [
      [2, 0, 2, 2],
      [4, 1, 4, 3],
      [6, 0, 6, 2],
    ],
  },
  {
    id: 'twin-wings',
    name: 'Twin Wings',
    size: 'Large',
    width: 18,
    height: 15,
    stepSize: 3,
    description: 'Two exhibition wings meet in a bright central spine.',
    interiorWalls: [
      [2, 0, 2, 2],
      [2, 3, 2, 5],
      [4, 0, 4, 2],
      [4, 3, 4, 5],
      [0, 2, 1, 2],
      [5, 2, 6, 2],
    ],
  },
  {
    id: 'pinwheel',
    name: 'The Pinwheel',
    size: 'Large',
    width: 18,
    height: 18,
    stepSize: 3,
    description: 'Four floating walls reveal the collection one turn at a time.',
    interiorWalls: [
      [1, 2, 3, 2],
      [4, 1, 4, 3],
      [3, 4, 5, 4],
      [2, 3, 2, 5],
    ],
  },
  {
    id: 'sequence',
    name: 'The Sequence',
    size: 'Large',
    width: 24,
    height: 12,
    stepSize: 3,
    description: 'Four chapters, with offset doorways to slow the pace.',
    interiorWalls: [
      [2, 0, 2, 1],
      [2, 2, 2, 4],
      [4, 0, 4, 2],
      [4, 3, 4, 4],
      [6, 0, 6, 1],
      [6, 2, 6, 4],
    ],
  },
  {
    id: 'forum',
    name: 'The Forum',
    size: 'Large',
    width: 24,
    height: 15,
    stepSize: 3,
    description: 'An expansive gathering space edged with smaller galleries.',
    interiorWalls: [
      [2, 0, 2, 1],
      [2, 2, 2, 3],
      [2, 4, 2, 5],
      [6, 0, 6, 1],
      [6, 2, 6, 3],
      [6, 4, 6, 5],
      [0, 3, 1, 3],
      [7, 3, 8, 3],
      [3, 2, 5, 2],
    ],
  },
  {
    id: 'pavilion',
    name: 'The Pavilion',
    size: 'Grand',
    width: 24,
    height: 18,
    stepSize: 3,
    description: 'Four freestanding corners keep a large collection airy.',
    interiorWalls: [
      [1, 1, 3, 1],
      [1, 1, 1, 2],
      [5, 1, 7, 1],
      [7, 1, 7, 2],
      [1, 5, 3, 5],
      [1, 4, 1, 5],
      [5, 5, 7, 5],
      [7, 4, 7, 5],
    ],
  },
  {
    id: 'museum-avenue',
    name: 'Museum Avenue',
    size: 'Grand',
    width: 30,
    height: 18,
    stepSize: 3,
    description: 'A broad avenue with side galleries for themed collections.',
    interiorWalls: [
      [3, 0, 3, 2],
      [3, 3, 3, 4],
      [3, 5, 3, 6],
      [7, 0, 7, 2],
      [7, 3, 7, 4],
      [7, 5, 7, 6],
      [0, 2, 2, 2],
      [8, 2, 10, 2],
      [0, 4, 2, 4],
      [8, 4, 10, 4],
    ],
  },
  {
    id: 'grand-salon',
    name: 'Grand Salon',
    size: 'Grand',
    width: 24,
    height: 24,
    stepSize: 3,
    description: 'A monumental central salon, open on all four sides.',
    interiorWalls: [
      [2, 2, 3, 2],
      [5, 2, 6, 2],
      [6, 2, 6, 3],
      [6, 5, 6, 6],
      [5, 6, 6, 6],
      [2, 6, 3, 6],
      [2, 5, 2, 6],
      [2, 2, 2, 3],
    ],
  },
  {
    id: 'retrospective',
    name: 'Retrospective',
    size: 'Grand',
    width: 30,
    height: 21,
    stepSize: 3,
    description: 'A winding, five-part journey for a lifetime of work.',
    interiorWalls: [
      [2, 0, 2, 5],
      [4, 2, 4, 7],
      [6, 0, 6, 5],
      [8, 2, 8, 7],
    ],
  },
  {
    id: 'biennale',
    name: 'The Biennale',
    size: 'Grand',
    width: 30,
    height: 24,
    stepSize: 3,
    description: 'A central installation court and two wings for a major show.',
    interiorWalls: [
      [2, 0, 2, 3],
      [2, 4, 2, 8],
      [8, 0, 8, 3],
      [8, 4, 8, 8],
      [0, 2, 1, 2],
      [9, 2, 10, 2],
      [0, 5, 1, 5],
      [9, 5, 10, 5],
      [4, 2, 4, 5],
      [6, 2, 6, 5],
      [4, 2, 6, 2],
    ],
  },
];

export const DEFAULT_PRESET_ID = 'salon';

export function createPresetLayout(preset: GalleryPreset): TRoomLayout {
  const columns = preset.width / preset.stepSize;
  const rows = preset.height / preset.stepSize;
  // Keep the entrance centered: one module for odd widths, two for even widths.
  const entranceStart = Math.floor((columns - 1) / 2);
  const entranceEnd = columns - entranceStart;
  const spans: readonly WallSpan[] = [
    [0, 0, columns, 0],
    [0, 0, 0, rows],
    [columns, 0, columns, rows],
    [0, rows, entranceStart, rows],
    [entranceEnd, rows, columns, rows],
    ...preset.interiorWalls,
  ];
  const walls: TWall[] = [];

  for (const [x1, y1, x2, y2] of spans) {
    const length = Math.abs(x2 - x1) + Math.abs(y2 - y1);
    const dx = Math.sign(x2 - x1);
    const dy = Math.sign(y2 - y1);
    for (let index = 0; index < length; index++) {
      const line = {
        start: { x: (x1 + dx * index) * preset.stepSize, y: (y1 + dy * index) * preset.stepSize },
        end: {
          x: (x1 + dx * (index + 1)) * preset.stepSize,
          y: (y1 + dy * (index + 1)) * preset.stepSize,
        },
      };
      walls.push({ id: wallKeyFromLine(line), line, doors: false, textureId: '1' });
    }
  }

  const id = `preset-${preset.id}`;
  return { rooms: { [id]: { id, walls, neighbors: [] } } };
}
