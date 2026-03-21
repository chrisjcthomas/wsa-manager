import path from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      extensions: ['.ts', '.mts', '.js', '.mjs', '.json'],
      alias: {
        '@main': path.resolve(__dirname, 'src/main'),
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      extensions: ['.ts', '.mts', '.js', '.mjs', '.json'],
      alias: {
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      extensions: ['.ts', '.tsx', '.mts', '.js', '.jsx', '.mjs', '.json'],
      alias: {
        '@renderer': path.resolve(__dirname, 'src/renderer/src'),
        '@shared': path.resolve(__dirname, 'src/shared')
      }
    },
    plugins: [react()]
  }
})
