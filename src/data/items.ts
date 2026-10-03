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
  skin('moss', 'common', '이끼 돌', 'Mossy Stone'),
  skin('mouse', 'common', '먼지 쥐', 'Dust Mouse'),
  skin('torch', 'common', '횃불지기', 'Torch Keeper'),
  skin('web', 'common', '거미줄 뭉치', 'Cobweb Ball'),
  skin('pot', 'common', '깨진 항아리', 'Cracked Pot'),
  skin('bat', 'common', '박쥐 날개', 'Bat Wings'),
  skin('slime', 'common', '슬라임', 'Slime'),
  skin('mushroom', 'common', '동굴 버섯', 'Cave Mushroom'),
  trail('steps', 'common', '발자국', 'Footprints'),
  trail('chalk', 'common', '분필 선', 'Chalk Line'),
  trail('drops', 'common', '물방울', 'Droplets'),
  trail('dust', 'common', '모래 먼지', 'Sand Dust'),

  skin('helmet', 'rare', '청동 투구', 'Bronze Helm'),
  skin('lantern', 'rare', '등불 탐험가', 'Lantern Explorer'),
  skin('skeleton', 'rare', '해골 병사', 'Skeleton Soldier'),
  skin('statue', 'rare', '돌 석상', 'Stone Statue'),
  skin('hunter', 'rare', '보물 사냥꾼', 'Treasure Hunter'),
  skin('ghost', 'rare', '유령', 'Ghost'),
  skin('mummy', 'rare', '미라', 'Mummy'),
  skin('goblin', 'rare', '고블린', 'Goblin'),
  trail('thread', 'rare', '붉은 실타래', 'Red Thread'),
  trail('embers', 'rare', '횃불 불씨', 'Torch Embers'),

  skin('minotaur', 'epic', '미노타우로스', 'Minotaur'),
  skin('mage', 'epic', '미궁의 마법사', 'Labyrinth Mage'),
  skin('knight', 'epic', '황금 갑옷 기사', 'Golden Knight'),
  skin('dragon', 'epic', '아기 용', 'Baby Dragon'),
  trail('wisp', 'epic', '도깨비불', 'Will-o-Wisp'),

  skin('king', 'legendary', '황금 미궁의 왕', 'Golden Labyrinth King'),
  skin('phoenix', 'legendary', '불사조', 'Phoenix'),
  trail('stars', 'legendary', '별빛 길', 'Starlight Path'),
];

export const ITEM_BY_ID = new Map(ITEMS.map((i) => [i.id, i]));
