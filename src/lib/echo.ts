import Echo from 'laravel-echo'
import Pusher from 'pusher-js'

declare global {
  interface Window {
    Pusher: typeof Pusher
  }
}

window.Pusher = Pusher

const key = import.meta.env.VITE_REVERB_APP_KEY
const host = import.meta.env.VITE_REVERB_HOST ?? '127.0.0.1'
const port = Number(import.meta.env.VITE_REVERB_PORT ?? 8080)
const scheme = import.meta.env.VITE_REVERB_SCHEME ?? 'http'

export const echo =
  key
    ? new Echo({
        broadcaster: 'reverb',
        key,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: scheme === 'https',
        enabledTransports: ['ws', 'wss'],
      })
    : null
