// 스킨은 주인공 여우가 입는 옷이다. 어떤 옷을 입어도 큰 귀와 빛나는 꼬리 끝은 그대로 보인다.
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type ItemType = 'skin' | 'trail';

export interface Item {
  id: string;
  type: ItemType;
  rarity: Rarity;
  ko: string;
  en: string;
}

// 아이템 하나가 나올 확률(%). 등급 합계는 60 / 28 / 10 / 2.
export const RARITY_WEIGHT: Record<Rarity, number> = { common: 5, rare: 2.8, epic: 2, legendary: 2 / 3 };
export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#aab2bf',
  rare: '#4f9dff',
  epic: '#b46bff',
  legendary: '#ffc531',
};
export const RARITY_ORDER: Rarity[] = ['common', 'rare', 'epic', 'legendary'];

export const DEFAULT_SKIN = 'default';
export const DEFAULT_TRAIL = 'none';

const skin = (id: string, rarity: Rarity, ko: string, en: string): Item => ({ id, type: 'skin', rarity, ko, en });
const trail = (id: string, rarity: Rarity, ko: string, en: string): Item => ({ id, type: 'trail', rarity, ko, en });

export const ITEMS: Item[] = [
  skin('moss', 'common', '이끼 망토', 'Moss Cape'),
  skin('mouse', 'common', '먼지 여우', 'Dusty Fox'),
  skin('torch', 'common', '불씨 목도리', 'Ember Scarf'),
  skin('web', 'common', '거미줄 숄', 'Cobweb Shawl'),
  skin('pot', 'common', '항아리 속 여우', 'Fox in a Pot'),
  skin('bat', 'common', '박쥐 망토', 'Bat Cape'),
  skin('slime', 'common', '이슬 비옷', 'Dew Raincoat'),
  skin('mushroom', 'common', '버섯 모자', 'Mushroom Hat'),
  trail('steps', 'common', '발자국', 'Footprints'),
  trail('chalk', 'common', '분필 선', 'Chalk Line'),
  trail('drops', 'common', '물방울', 'Droplets'),
  trail('dust', 'common', '모래 먼지', 'Sand Dust'),

  skin('helmet', 'rare', '청동 투구', 'Bronze Helm'),
  skin('lantern', 'rare', '등불 탐험가', 'Lantern Explorer'),
  skin('skeleton', 'rare', '뼈다귀 잠옷', 'Bone Pajamas'),
  skin('statue', 'rare', '돌이 된 여우', 'Stone Fox'),
  skin('hunter', 'rare', '보물 사냥꾼', 'Treasure Hunter'),
  skin('ghost', 'rare', '안개 여우', 'Mist Fox'),
  skin('mummy', 'rare', '붕대 여우', 'Bandaged Fox'),
  skin('goblin', 'rare', '도깨비 옷', 'Goblin Outfit'),
  trail('thread', 'rare', '붉은 실타래', 'Red Thread'),
  trail('embers', 'rare', '횃불 불씨', 'Torch Embers'),

  skin('minotaur', 'epic', '미궁의 뿔', 'Labyrinth Horns'),
  skin('mage', 'epic', '서고의 현자', 'Archive Sage'),
  skin('knight', 'epic', '황금 기사', 'Golden Knight'),
  skin('dragon', 'epic', '아기 용 옷', 'Dragon Onesie'),
  trail('wisp', 'epic', '도깨비불', 'Will-o-Wisp'),

  skin('king', 'legendary', '심장의 왕', 'King of the Heart'),
  skin('phoenix', 'legendary', '불사조 여우', 'Phoenix Fox'),
  trail('stars', 'legendary', '별빛 길', 'Starlight Path'),
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
