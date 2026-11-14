// One slice of a liver lobule at cell tier. Blood enters at the portal vessels in the
// corners, runs through the sinusoids between plates of hepatocytes, and drains out the
// central vein in the middle.
//   # hepatocyte   . sinusoid   g glucose-rich patch   P portal vessel   V central vein
export const LIVER_MAP = [
  '#########################',
  '#P....#...g...#....#...P#',
  '#.###.#.###.#.#.##.#.#..#',
  '#.#.....#...#......#.#.##',
  '#.#.###.#.###.###.##...g#',
  '#...#.....#.....#....##.#',
  '###.#.###...#.#...##..#.#',
  '#g..#.#...#.#V#.#..#.##.#',
  '#.###.#.###.#.#.##.#....#',
  '#.....#.....#...#....##.#',
  '#.###...###...#...##.#..#',
  '#.#.#.#.#.#.###.#..#.#.##',
  '#...#.#...#.....##...#..#',
  '#.#...###.#.###.#..#.##.#',
  '#.###.#...#...#...##..#.#',
  '#P..g.#.#...#...#...g..P#',
  '#########################',
];

export const START = { x: 1, y: 1 };
export const KUPFFER_STARTS = [
  { x: 19, y: 5 },
  { x: 15, y: 9 },
];
export const NEUTROPHIL_STARTS = [
  { x: 5, y: 9 },
  { x: 22, y: 12 },
];
