// 처음 켰을 때 차례로 하는 안내 레벨. 한 레벨에 규칙 하나만 가르친다.
// 별과 골드는 주지 않고, 다음 수를 화살표로 계속 보여준다.

export interface TutorialLevel {
  id: string;
  rows: string[];
  solution: string;
  // [한국어, 영어]. start는 시작할 때, pushed는 처음 밀었을 때, bumped는 처음 막혔을 때 보여준다.
  start: [string, string];
  pushed?: [string, string];
  bumped?: [string, string];
}

export const TUTORIALS: TutorialLevel[] = [
  {
    id: 'T-1',
    rows: ['P..', '##.', 'E..'],
    solution: 'RRDDLL',
    start: ['화면을 밀어서 여우를 움직여요.\n빛나는 출구까지 가 보세요!', 'Swipe to move the fox.\nReach the glowing exit!'],
  },
  {
    id: 'T-2',
    rows: ['P.B..', '###.#', '##E.#'],
    solution: 'RRRDDL',
    start: ['상자가 길을 막고 있어요.\n상자 쪽으로 밀어 보세요.', 'A crate blocks the way.\nPush into it.'],
    pushed: ['밀렸어요! 상자는 밀기만 할 수 있고\n당길 수는 없어요.', 'It moved! Crates can be pushed,\nnever pulled.'],
  },
  {
    id: 'T-3',
    rows: ['P.BB.', '.####', '.B..#', '##.E#'],
    solution: 'DDRRDR',
    start: ['상자 두 개가 붙어 있으면 밀 수 없어요.\n다른 길을 찾아보세요.', "Two crates in a row won't move.\nFind another way."],
    bumped: ['막혔다면 아래 되돌리기로\n한 수씩 무를 수 있어요.', 'Stuck? Undo takes back\none move at a time.'],
    pushed: ['좋아요! 어떤 상자를 어디로 밀지가\n이 게임의 전부예요.', 'Nice! Choosing which crate to push,\nand where, is the whole game.'],
  },
  {
    id: 'T-4',
    rows: ['P.X..', '.###.', '.B...', '###E#'],
    solution: 'DDRRRD',
    start: ['빛을 잃은 돌은 절대 움직이지 않아요.\n적게 움직일수록 별을 많이 받아요.', 'Stones that lost their light never move.\nFewer moves earn more stars.'],
  },
];
