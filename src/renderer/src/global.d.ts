import type { WsaApi } from '../../preload/index'

declare global {
  interface Window {
    wsaApi: WsaApi
  }
}

export {}
