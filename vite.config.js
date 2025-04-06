import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 3000,
    open: true // automatically open browser
  },
  root: 'src', // Set the root directory to src
  publicDir: '../public', // If you have any public assets
  build: {
    outDir: '../dist', // Output directory for production build
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html')
      }
    }
  }
}); 