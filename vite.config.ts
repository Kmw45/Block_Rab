import { defineConfig } from 'vite';

// 상대 경로로 빌드해 앱 패키지(WebView) 안에서도 그대로 열리게 한다
export default defineConfig({ base: './' });