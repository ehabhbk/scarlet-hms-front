import { useEffect, useRef, useState } from 'react'

export function SplashScreen({ onDone }: { onDone: () => void }) {
  const [leaving, setLeaving] = useState(false)
  const finished = useRef(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setLeaving(true)
      setTimeout(() => {
        if (!finished.current) {
          finished.current = true
          onDone()
        }
      }, 450)
    }, 2900)

    return () => clearTimeout(timer)
  }, [onDone])

  const finishNow = () => {
    if (finished.current) return
    finished.current = true
    onDone()
  }

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#3A0513] transition-opacity duration-500 ${
        leaving ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="pointer-events-none absolute -left-24 top-1/4 h-96 w-96 rounded-full bg-scarlet-700/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-scarlet-500/20 blur-3xl" />

      <video
        className="absolute inset-0 h-full w-full object-cover opacity-70"
        src="/brand/scarlet-splash.mp4"
        autoPlay
        muted
        playsInline
        onEnded={finishNow}
        aria-hidden
      />

      <div className="relative z-10 flex flex-col items-center px-8 text-center">
        <div className="rounded-3xl bg-white px-7 py-6 shadow-2xl shadow-black/30 ring-1 ring-white/40">
          <img
            src="/brand/scarlet-wordmark.png"
            alt="Scarlet Care"
            className="h-28 w-auto object-contain sm:h-36"
            draggable={false}
          />
        </div>
        <p className="mt-7 text-sm font-semibold tracking-[0.35em] text-white/70">SCARLET HMS</p>
        <div className="mt-5 h-1 w-40 overflow-hidden rounded-full bg-white/15">
          <div className="h-full w-1/2 animate-[shimmer_1.2s_linear_infinite] rounded-full bg-gradient-to-r from-scarlet-300 to-white" />
        </div>
      </div>

      <button
        type="button"
        onClick={finishNow}
        className="absolute bottom-8 z-10 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80 backdrop-blur transition hover:bg-white/20"
      >
        تخطي
      </button>
    </div>
  )
}
