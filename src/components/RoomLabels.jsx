function RoomLabels({ labels, className = '' }) {
  return (
    <div className={`pointer-events-none absolute inset-x-0 bottom-0 top-0 z-20 overflow-hidden ${className}`}>
      {labels.map((label) => (
        <div
          key={label.id}
          style={{
            transform: `translate(${label.x}px, ${label.y}px) translate(-50%, -50%)`,
            opacity: label.visible ? 1 : 0,
          }}
          className="absolute left-0 top-0 transition-opacity duration-150"
        >
          <span
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium backdrop-blur-sm ${
              label.active
                ? 'border-cyan-400/70 bg-cyan-500/20 text-cyan-100'
                : 'border-slate-700/80 bg-slate-950/75 text-slate-200'
            }`}
          >
            {label.name}
          </span>
        </div>
      ))}
    </div>
  )
}

export default RoomLabels