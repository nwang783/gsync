import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const projectId = env.VITE_FIREBASE_PROJECT_ID || 'nomergeconflicts';
  const functionsOrigin = env.VITE_FUNCTIONS_ORIGIN || 'http://127.0.0.1:5001';

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: functionsOrigin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, `/${projectId}/us-central1/api`),
        },
      },
    },
  };
});
