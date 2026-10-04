import { DEV_MODE, persist, save } from './store';

// 광고 계층. 웹 빌드에는 실제 광고 SDK가 없어 자리 표시 화면을 보여준다.
// Android 빌드에서는 setAdProvider로 AdMob 구현을 넣는다.

export interface AdProvider {
  // 끝까지 봤으면 true. 광고를 불러오지 못해도 true를 돌려 보상은 그대로 준다.
  showRewarded(): Promise<boolean>;
  showInterstitial(): Promise<void>;
}

function placeholder(label: string, seconds: number): Promise<void> {
  if (DEV_MODE) return Promise.resolve(); // 개발자 모드에서는 광고 화면을 건너뛴다
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'ad-placeholder';
    el.innerHTML = `<div class="ad-box"><div class="ad-tag">AD</div><div class="ad-label">${label}</div><div class="ad-count"></div></div>`;
    document.body.appendChild(el);
    const count = el.querySelector('.ad-count') as HTMLElement;
    let left = seconds;
    count.textContent = String(left);
    const timer = window.setInterval(() => {
      left--;
      count.textContent = String(Math.max(left, 0));
      if (left <= 0) {
        clearInterval(timer);
        el.remove();
        resolve();
      }
    }, 1000);
  });
}

const webProvider: AdProvider = {
  async showRewarded() {
    await placeholder('보상형 광고 자리 · Rewarded ad slot', 2);
    return true;
  },
  async showInterstitial() {
    await placeholder('전면 광고 자리 · Interstitial ad slot', 2);
  },
};

let provider: AdProvider = webProvider;

export function setAdProvider(p: AdProvider): void {
  provider = p;
}

// 어떤 광고든 본 시각을 남겨, 보상형 광고 직후에 전면 광고가 겹치지 않게 한다
function markAdShown(): void {
  save.lastAdAt = Date.now();
  persist();
}

export const ads = {
  async rewarded(): Promise<boolean> {
    try {
      markAdShown();
      return await provider.showRewarded();
    } catch {
      return true;
    }
  },
  async interstitial(): Promise<void> {
    try {
      markAdShown();
      await provider.showInterstitial();
    } catch {
      // 광고가 없어도 게임은 계속된다
    }
  },
};
