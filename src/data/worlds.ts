export interface WorldTheme {
  ko: string;
  en: string;
  bgTop: string;
  bgBottom: string;
  accent: string;
  accentDark: string;
  floorA: string;
  floorB: string;
  wall: string;
  wallTop: string;
}

// 월드마다 배경색과 강조색 한 쌍
export const WORLDS: WorldTheme[] = [
  {
    ko: '무너진 유적',
    en: 'Crumbling Ruins',
    bgTop: '#2b2540',
    bgBottom: '#16121f',
    accent: '#f2a541',
    accentDark: '#b56f16',
    floorA: '#3d3556',
    floorB: '#383050',
    wall: '#1e1a2c',
    wallTop: '#574c78',
  },
  {
    ko: '버려진 광산',
    en: 'Abandoned Mine',
    bgTop: '#1f3340',
    bgBottom: '#0f1a22',
    accent: '#4fd1a5',
    accentDark: '#1f8f6b',
    floorA: '#2c4a59',
    floorB: '#284452',
    wall: '#13232c',
    wallTop: '#42707f',
  },
  {
    ko: '얼음 동굴',
    en: 'Ice Cavern',
    bgTop: '#1d2f55',
    bgBottom: '#0d1630',
    accent: '#7fd4ff',
    accentDark: '#2f8fc9',
    floorA: '#2b4273',
    floorB: '#273c6a',
    wall: '#111c3a',
    wallTop: '#4767a8',
  },
  {
    ko: '마법 서고',
    en: 'Arcane Archive',
    bgTop: '#40252f',
    bgBottom: '#1f1016',
    accent: '#ff7d6b',
    accentDark: '#c2412f',
    floorA: '#5a3441',
    floorB: '#522f3b',
    wall: '#2a151c',
    wallTop: '#8a4f60',
  },
  {
    ko: '톱니 성채',
    en: 'Clockwork Keep',
    bgTop: '#3a3320',
    bgBottom: '#1a160c',
    accent: '#e6c15a',
    accentDark: '#a37f1f',
    floorA: '#51482d',
    floorB: '#4a4229',
    wall: '#231e10',
    wallTop: '#7d6f43',
  },
  {
    ko: '용암 동굴',
    en: 'Lava Cavern',
    bgTop: '#40201a',
    bgBottom: '#1c0c09',
    accent: '#ff8a3d',
    accentDark: '#c2501a',
    floorA: '#59302a',
    floorB: '#522b26',
    wall: '#2a1310',
    wallTop: '#8a4a3e',
  },
  {
    ko: '쌍둥이 신전',
    en: 'Twin Temple',
    bgTop: '#3d2a3c',
    bgBottom: '#1b1120',
    accent: '#ff9ccb',
    accentDark: '#c2598c',
    floorA: '#553b56',
    floorB: '#4e3650',
    wall: '#261827',
    wallTop: '#8a6189',
  },
  {
    ko: '미궁의 심장',
    en: 'Heart of the Labyrinth',
    bgTop: '#3a2a52',
    bgBottom: '#170f26',
    accent: '#d48cff',
    accentDark: '#8b3fc4',
    floorA: '#4d3a6e',
    floorB: '#463466',
    wall: '#211636',
    wallTop: '#7a59ab',
  },
];
