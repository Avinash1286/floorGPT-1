import {
  Cuboid,
  Expand,
  House,
  Lightbulb,
  Minimize,
  Pause,
  Play,
  RotateCcw,
  ScanEye,
  Sun,
  Tags,
} from 'lucide-react'

const VIEW_OPTIONS = [
  { id: 'perspective', label: 'Perspective' },
  { id: 'top', label: 'Top view' },
]

const SHADING_OPTIONS = [
  { id: 'standard', label: 'Standard (PBR)' },
  { id: 'phong', label: 'Phong' },
  { id: 'lambert', label: 'Lambert' },
  { id: 'basic', label: 'Basic' },
]

function Toolbar({
  viewMode,
  onChangeViewMode,
  environmentPreset,
  environmentOptions,
  onChangeEnvironmentPreset,
  labelsVisible,
  onToggleLabels,
  isFullscreen,
  onToggleFullscreen,
  shadingMode,
  onChangeShadingMode,
  wireframe,
  onToggleWireframe,
  roofVisible,
  onToggleRoof,
  shadowsEnabled,
  onToggleShadows,
  lightIntensity,
  onChangeLightIntensity,
  isFlythroughRunning,
  canFlythrough,
  onToggleFlythrough,
  isWalkthroughRunning,
  canWalkthrough,
  onToggleWalkthrough,
  onResetCamera,
}) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-1">
        {VIEW_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChangeViewMode(option.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              viewMode === option.id
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900 p-1">
        {SHADING_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChangeShadingMode(option.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
              shadingMode === option.id
                ? 'bg-cyan-500/20 text-cyan-200'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
        <span className="text-slate-400">Env</span>
        <select
          value={environmentPreset}
          onChange={(event) => onChangeEnvironmentPreset(event.target.value)}
          className="bg-transparent text-xs text-slate-200 outline-none"
          aria-label="Environment preset"
        >
          {environmentOptions.map((option) => (
            <option key={option.id} value={option.id} className="bg-slate-900 text-slate-100">
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="button"
        className={`btn-secondary !px-3 !py-2 ${wireframe ? '!border-cyan-500/50 !text-cyan-200' : ''}`}
        onClick={onToggleWireframe}
      >
        <Cuboid size={15} />
        <span className="hidden sm:inline">Wireframe</span>
      </button>

      <button
        type="button"
        className={`btn-secondary !px-3 !py-2 ${labelsVisible ? '!border-cyan-500/50 !text-cyan-200' : ''}`}
        onClick={onToggleLabels}
      >
        <Tags size={15} />
        <span className="hidden sm:inline">Labels</span>
      </button>

      <button
        type="button"
        className={`btn-secondary !px-3 !py-2 ${roofVisible ? '!border-cyan-500/50 !text-cyan-200' : ''}`}
        onClick={onToggleRoof}
      >
        <House size={15} />
        <span className="hidden sm:inline">Roof</span>
      </button>

      <button
        type="button"
        className={`btn-secondary !px-3 !py-2 ${shadowsEnabled ? '!border-cyan-500/50 !text-cyan-200' : ''}`}
        onClick={onToggleShadows}
      >
        <Lightbulb size={15} />
        <span className="hidden sm:inline">Shadows</span>
      </button>

      <label className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300">
        <Sun size={14} className="text-amber-300" />
        <input
          type="range"
          min="0.5"
          max="1.7"
          step="0.05"
          value={lightIntensity}
          onChange={(event) => onChangeLightIntensity(Number(event.target.value))}
          className="h-1 w-24 cursor-pointer accent-cyan-400"
          aria-label="Light intensity"
        />
      </label>

      <button type="button" className="btn-secondary !px-3 !py-2" onClick={onResetCamera}>
        <RotateCcw size={15} />
        <span className="hidden sm:inline">Reset</span>
      </button>

      <button
        type="button"
        className={`btn-secondary !px-3 !py-2 ${isFullscreen ? '!border-cyan-500/50 !text-cyan-200' : ''}`}
        onClick={onToggleFullscreen}
      >
        {isFullscreen ? <Minimize size={15} /> : <Expand size={15} />}
        <span className="hidden sm:inline">{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
      </button>

      <button
        type="button"
        className={`btn-secondary !px-3 !py-2 ${
          isFlythroughRunning ? '!border-cyan-500/50 !text-cyan-200' : ''
        }`}
        onClick={onToggleFlythrough}
        disabled={!canFlythrough}
      >
        {isFlythroughRunning ? <Pause size={15} /> : <Play size={15} />}
        <span className="hidden sm:inline">Flythrough</span>
      </button>

      <button
        type="button"
        className={`btn-secondary !px-3 !py-2 ${
          isWalkthroughRunning ? '!border-cyan-500/50 !text-cyan-200' : ''
        }`}
        onClick={onToggleWalkthrough}
        disabled={!canWalkthrough}
      >
        <ScanEye size={15} />
        <span className="hidden sm:inline">Walkthrough</span>
      </button>

      <span className="status-chip hidden lg:inline-flex">
        <ScanEye size={14} />
        {isWalkthroughRunning
          ? 'Walkthrough active'
          : isFlythroughRunning
            ? 'Flythrough active'
            : 'Interactive viewport'}
      </span>
    </div>
  )
}

export default Toolbar
