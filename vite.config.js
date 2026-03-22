import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/three/examples')) {
            return 'three-examples'
          }

          if (id.includes('node_modules/three')) {
            return 'three-core'
          }

          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }

          if (id.includes('node_modules/lucide-react')) {
            return 'ui-vendor'
          }

          return undefined
        },
      },
    },
  },
})
