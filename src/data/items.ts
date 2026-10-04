// 스킨은 미궁의 정령이 옛 수호자나 미궁에 사는 것의 모습을 빌려 입은 것이다.
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
  skin('moss', 'common', '이끼 정령', 'Moss Spirit'),
  skin('mouse', 'common', '먼지쥐 정령', 'Dust Mouse Spirit'),
  skin('torch', 'common', '불씨 정령', 'Ember Spirit'),
  skin('web', 'common', '거미줄 정령', 'Cobweb Spirit'),
  skin('pot', 'common', '항아리 정령', 'Pot Spirit'),
  skin('bat', 'common', '박쥐 정령', 'Bat Spirit'),
  skin('slime', 'common', '이슬 정령', 'Dew Spirit'),
  skin('mushroom', 'common', '버섯 정령', 'Mushroom Spirit'),
  trail('steps', 'common', '발자국', 'Footprints'),
  trail('chalk', 'common', '분필 선', 'Chalk Line'),
  trail('drops', 'common', '물방울', 'Droplets'),
  trail('dust', 'common', '모래 먼지', 'Sand Dust'),

  skin('helmet', 'rare', '청동 수호령', 'Bronze Guardian'),
  skin('lantern', 'rare', '등불 길잡이', 'Lantern Guide'),
  skin('skeleton', 'rare', '백골 수호령', 'Bone Guardian'),
  skin('statue', 'rare', '석상 수호령', 'Stone Guardian'),
  skin('hunter', 'rare', '모험가 정령', 'Adventurer Spirit'),
  skin('ghost', 'rare', '안개 정령', 'Mist Spirit'),
  skin('mummy', 'rare', '붕대 정령', 'Wrapped Spirit'),
  skin('goblin', 'rare', '도깨비 정령', 'Goblin Spirit'),
  trail('thread', 'rare', '붉은 실타래', 'Red Thread'),
  trail('embers', 'rare', '횃불 불씨', 'Torch Embers'),

  skin('minotaur', 'epic', '뿔 수호령', 'Horned Guardian'),
  skin('mage', 'epic', '서고의 현자', 'Archive Sage'),
  skin('knight', 'epic', '황금 수호 기사', 'Golden Guardian'),
  skin('dragon', 'epic', '아기 용 정령', 'Dragon Spirit'),
  trail('wisp', 'epic', '도깨비불', 'Will-o-Wisp'),

  skin('king', 'legendary', '심장의 왕', 'King of the Heart'),
  skin('phoenix', 'legendary', '불사조 정령', 'Phoenix Spirit'),
  trail('stars', 'legendary', '별빛 길', 'Starlight Path'),
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
