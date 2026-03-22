import { Loader2 } from 'lucide-react'

function LoadingScreen({ message }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm">
      <div className="panel w-[min(480px,92vw)] p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500/20 text-cyan-200">
          <Loader2 size={24} className="animate-spin" />
        </div>
        <h3 className="text-base font-semibold text-slate-100">Processing floor plan</h3>
        <p className="mt-2 text-sm text-slate-300">{message}</p>
      </div>
    </div>
  )
}

export default LoadingScreen