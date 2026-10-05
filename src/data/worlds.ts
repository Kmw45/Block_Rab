export interface WorldTheme {
  ko: string;
  en: string;
  // 스테이지 화면의 던전 머리말에 보여 주는 한 줄 이야기
  storyKo: string;
  storyEn: string;
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
    storyKo: "빛이 꺼지며 가장 먼저 무너진 회랑. 꺼진 바닥을 메워 길을 이어요.",
    storyEn: "The first halls to fall when the light went out. Fill the gaps to go on.",
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
    storyKo: "빛을 캐던 광산. 수레 길은 한쪽으로만 흘러요.",
    storyEn: "Where light was once mined. The cart tracks run one way only.",
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
    storyKo: "빛이 떠나자 얼어붙은 동굴. 한번 미끄러지면 멈출 수 없어요.",
    storyEn: "A cave that froze when the light left. Once you slide, you cannot stop.",
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
    storyKo: "미궁의 기억이 잠든 서고. 마법진은 빛을 지닌 여우만 탈 수 있어요.",
    storyEn: "Where the labyrinth's memory sleeps. Only the fox, who carries the light, can ride the circles.",
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
    storyKo: "기계로 미궁을 다스리려던 성. 여우는 가벼워서 스위치가 눌리지 않아요.",
    storyEn: "A keep that tried to rule by machine. The fox is too light to press a switch.",
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
    storyKo: "심장의 열기가 새어 나온 동굴. 지나온 바닥은 무너져 내려요.",
    storyEn: "The heart's heat leaks into this cave. The floor falls away behind you.",
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
    storyKo: "빛과 그림자를 함께 모시던 신전. 쌍둥이는 언제나 함께 움직여요.",
    storyEn: "A temple to light and shadow. The twins always move together.",
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
    storyKo: "돌아왔어요. 흩어진 빛을 모아 심장을 다시 밝혀요.",
    storyEn: "Home at last. Gather the scattered light and relight the heart.",
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
