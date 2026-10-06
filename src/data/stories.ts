// 던전 이야기. 던전마다 네 장이고, 그 던전의 단계를 STORY_STEP개 지날 때마다 한 장씩 열린다(첫 장은 처음부터 보인다).
// 1 도착, 2 길을 내다, 3 누군가를 만나다, 4 빛이 돌아오다. 그림은 public/assets/scenes/scene_<던전>_<장>.jpg
// (tools/gen-sprites.mjs의 SCENES)이고, 서른두 장이라 시작할 때 불러오지 않고 필요할 때 주소로 부른다.

export const STORY_STEP = 4;
export const STORY_PAGES_PER_WORLD = 4;

// [한국어, 영어]
export const WORLD_STORIES: [string, string][][] = [
  [
    ['빛이 꺼지며 가장 먼저 무너진 회랑.\n여우는 어둠 속으로 한 발을 내디뎠어요.', 'The first halls to fall when the light went out.\nThe fox took one step into the dark.'],
    ['돌을 밀어 꺼진 바닥을 메우자,\n꺼져 있던 등불 하나가 깜빡 켜졌어요.', 'A stone pushed into the gap made a path,\nand one old lantern flickered back on.'],
    ['돌무더기 속에서 누군가 눈을 떴어요.\n유적을 지키던 작은 돌 지킴이였어요.', 'Someone woke among the fallen stones:\nthe little stone keeper of the ruins.'],
    ['회랑에 아침이 돌아왔어요.\n지킴이가 가리킨 문 너머로 길이 이어져요.', 'Morning came back to the halls.\nBeyond the door the keeper showed, the path goes on.'],
  ],
  [
    ['빛을 캐던 광산은 조용히 잠들어 있었어요.\n녹슨 수레 길만 안쪽으로 이어졌어요.', 'The mine that once dug up light lay asleep.\nOnly rusty cart tracks led inside.'],
    ['수레 길은 한쪽으로만 흘러요.\n여우가 지나간 자리마다 광석이 빛나기 시작했어요.', 'The cart tracks run one way only.\nWherever the fox passed, the ore began to glow.'],
    ['꺼진 등을 안고 앉아 있던 두더지 광부.\n여우의 꼬리빛이 그 등에 옮겨붙었어요.', 'A mole miner sat holding a lamp gone dark.\nThe light of the fox\'s tail caught on it.'],
    ['광산이 다시 반짝여요.\n두더지가 손을 흔드는 굴 끝에서 찬 바람이 불어와요.', 'The mine sparkles again.\nPast the waving mole, a cold wind blows from the tunnel\'s end.'],
  ],
  [
    ['빛이 떠나자 동굴은 꽁꽁 얼어붙었어요.\n숨결마저 하얗게 얼었어요.', 'When the light left, the cave froze solid.\nEven a breath turned white.'],
    ['한번 미끄러지면 멈출 수 없어요.\n그래도 지나간 얼음 위엔 빛이 남았어요.', 'Once you slide, you cannot stop.\nStill, light stayed on the ice left behind.'],
    ['눈구덩이에서 떨고 있던 눈토끼.\n여우는 따뜻한 꼬리로 감싸 주었어요.', 'A snow hare shivered in a hollow of snow.\nThe fox wrapped it in a warm tail.'],
    ['얼음이 별처럼 빛나고 오로라가 떠올랐어요.\n눈토끼가 얼음 속의 커다란 문을 가리켜요.', 'The ice shone like stars and an aurora rose.\nThe hare points to a great door in the ice.'],
  ],
  [
    ['미궁의 기억이 잠든 서고.\n책들은 쓰러지고 촛불은 꺼져 있었어요.', 'The archive where the labyrinth\'s memory sleeps.\nBooks lay fallen and the candles were out.'],
    ['마법진을 밟자 몸이 훌쩍 날아갔어요.\n빛을 지닌 여우만 탈 수 있는 길이에요.', 'One step on a magic circle and whoosh!\nOnly the fox, who carries the light, can ride it.'],
    ['책 더미 위에서 졸고 있던 부엉이 사서.\n꼬리빛에 한쪽 눈을 살며시 떴어요.', 'An owl librarian dozed on a pile of books.\nAt the tail\'s glow, it opened one eye.'],
    ['촛불이 켜지고 책들이 제자리로 돌아갔어요.\n부엉이가 펼친 책에는 톱니의 성이 그려져 있어요.', 'Candles lit and books flew home.\nThe owl\'s open book shows a fortress of gears.'],
  ],
  [
    ['톱니의 성은 멈춰 있었어요.\n커다란 톱니도, 무거운 문도 꼼짝하지 않았어요.', 'The fortress of gears stood still.\nNeither the great gears nor the heavy gate would move.'],
    ['상자를 스위치에 올리자 문이 열렸어요.\n멈췄던 톱니 하나가 다시 돌기 시작했어요.', 'A crate on the switch raised the gate.\nOne stopped gear began to turn again.'],
    ['태엽이 풀려 멈춰 선 양철 병정.\n여우가 등의 태엽을 감아 주었어요.', 'A tin soldier had wound down and stopped.\nThe fox turned the key on its back.'],
    ['성이 다시 째깍째깍 숨을 쉬어요.\n병정이 경례하는 문 너머가 붉게 빛나요.', 'The fortress ticks and breathes again.\nBeyond the saluting soldier, the way glows red.'],
  ],
  [
    ['용암마저 식어 버린 어두운 동굴.\n발밑의 바닥은 금이 가 있었어요.', 'A dark cave where even the lava had cooled.\nThe floor underfoot was cracked.'],
    ['밟고 지나간 바닥은 무너져 내려요.\n돌아갈 수 없으니, 앞으로 가는 수밖에요.', 'The floor falls away behind each step.\nNo going back, so onward it is.'],
    ['꼬리 불이 꺼져 웅크린 아기 불도롱뇽.\n여우가 꼬리 끝을 살짝 맞대 주었어요.', 'A baby salamander curled up, its tail flame out.\nThe fox gently touched tail tip to tail tip.'],
    ['동굴이 따뜻한 빛으로 물들었어요.\n도롱뇽이 불을 밝히며 하얀 계단으로 이끌어요.', 'The cave filled with warm light.\nThe salamander lights the way to white stairs.'],
  ],
  [
    ['똑같이 생긴 두 개의 방, 쌍둥이 신전.\n마주 보던 두 석상은 등을 돌리고 있었어요.', 'Two rooms exactly alike: the Twin Temple.\nIts two statues had turned their backs.'],
    ['한쪽을 밀면 다른 쪽도 함께 움직여요.\n떨어져 있어도 둘은 이어져 있었어요.', 'Push one and the other moves too.\nEven apart, the two were joined.'],
    ['벽을 사이에 두고 서로를 부르던 쌍둥이 양.\n여우가 꼬리를 들어 길을 비춰 주었어요.', 'Twin lambs called to each other across a wall.\nThe fox raised its tail to light the way.'],
    ['두 석상이 다시 마주 보았어요.\n쌍둥이가 함께 연 문 너머로 별빛이 쏟아져요.', 'The two statues face each other again.\nStarlight pours through the door the twins opened together.'],
  ],
  [
    ['미궁의 가장 깊은 곳.\n금이 간 심장이 희미하게 떠 있었어요.', 'The deepest place in the labyrinth.\nThe cracked heart floated there, faint.'],
    ['뒤돌아보니 지나온 길마다\n친구들의 불빛이 작게 반짝이고 있었어요.', 'Looking back, along every path behind,\nthe lights of friends twinkled small.'],
    ['여우가 꼬리를 들어 올리자,\n빛 조각이 심장의 빈자리로 떠올랐어요.', 'The fox lifted its tail,\nand the shard of light rose to the gap in the heart.'],
    ['심장이 다시 뛰고, 미궁에 빛이 돌아왔어요.\n여우의 꼬리 끝에는 작은 불씨가 남았어요.', 'The heart beat again and light returned to the labyrinth.\nA small spark stayed on the tip of the fox\'s tail.'],
  ],
];

// 그 던전에서 지난 단계 수로 열린 장 수(1~4)
export function storyPagesOpen(passed: number): number {
  return Math.min(STORY_PAGES_PER_WORLD, 1 + Math.floor(passed / STORY_STEP));
}

export function sceneUrl(world: number, page: number): string {
  return `${import.meta.env.BASE_URL}assets/scenes/scene_${world}_${page}.jpg`;
}
