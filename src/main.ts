import './styles.css';
import { sfx, unlockAudio } from './game/audio';
import { DEV_MODE, LEVELS, loadSave, save } from './game/store';
import { initFx } from './render/fx';
import { loadSprites } from './render/sprites';
import { applyArt, showCosmetics, showPlay, showSelect, showStory, showTitle, showTutorial } from './ui/app';

loadSave();
initFx();

// 브라우저는 첫 터치 뒤에만 소리를 낼 수 있다
addEventListener('pointerdown', unlockAudio, { capture: true });
addEventListener('keydown', unlockAudio, { capture: true });

// 자체 소리가 없는 버튼의 공통 클릭음
const OWN_SOUND = new Set(['undo', 'restart', 'hint', 'draw', 'multi', 'addraw']);
addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (btn && !btn.disabled && !OWN_SOUND.has(btn.dataset.a ?? '')) sfx.button();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

void loadSprites().then(() => {
  applyArt();
  // 개발 서버와 개발자 모드(?dev) 전용 바로가기: go=select | cosmetics | story | play:3-2 | tut:0, gold=500
  if (import.meta.env.DEV || DEV_MODE) {
    if (DEV_MODE) document.documentElement.classList.add('dev-mode');
    const q = new URLSearchParams(location.search);
    if (q.has('gold')) save.gold = Number(q.get('gold'));
    const go = q.get('go') ?? '';
    if (go === 'select') return showSelect();
    if (go === 'cosmetics') return showCosmetics();
    if (go === 'story') return showStory(showTitle);
    if (go.startsWith('tut:')) return showTutorial(Number(go.split(':')[1]));
    const level = LEVELS.find((l) => l.id === go.split(':')[1]);
    if (level) return showPlay(level);
    if (DEV_MODE) return showSelect();
  }
  showTitle();
});
