import { lazy, Suspense, useMemo, useState } from 'react'
import { BrainCircuit, CheckCircle2, Database, Sparkles } from 'lucide-react'
import JsonPreview from './components/JsonPreview'
import LoadingScreen from './components/LoadingScreen'
import UploadPanel from './components/UploadPanel'
import demoSceneGraphData from './data/demoSceneGraph.json'
import { analyzeFloorPlanImage, getGeminiModel } from './services/geminiService'
import { normalizeSceneGraph } from './services/sceneParser'
import { buildSceneMetrics, createEmptySceneGraph } from './utils/sceneBuilder'

const ViewerPanel = lazy(() => import('./components/ViewerPanel'))
const DEMO_SCENE_GRAPH = normalizeSceneGraph(demoSceneGraphData)
const DEMO_SCENE_RAW_JSON = JSON.stringify(demoSceneGraphData, null, 2)
const DEMO_ANALYSIS_DELAY_MS = 3000

function ViewerLoadingFallback() {
  return (
    <section className="panel relative h-[560px] overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center bg-slate-950/70">
        <div className="text-center">
          <p className="text-sm font-medium text-slate-100">Loading 3D viewer…</p>
          <p className="mt-1 text-xs text-slate-400">Preparing Three.js renderer and scene modules.</p>
        </div>
      </div>
    </section>
  )
}

const PHASE_ROADMAP = [
  { name: 'Phase 1', label: 'Setup + upload + raw JSON', status: 'completed' },
  { name: 'Phase 2', label: 'Gemini parsing hardening', status: 'completed' },
  { name: 'Phase 3', label: 'Geometry generation', status: 'completed' },
  { name: 'Phase 4', label: 'Lighting + shading', status: 'completed' },
  { name: 'Phase 5', label: 'Viewer interactions', status: 'completed' },
]

function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [sceneGraph, setSceneGraph] = useState(createEmptySceneGraph())
  const [rawJson, setRawJson] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [isDemoMode, setIsDemoMode] = useState(false)
  const [responseSource, setResponseSource] = useState('idle')

  const hasApiKey = Boolean(import.meta.env.VITE_GEMINI_API_KEY)
  const geminiModel = useMemo(() => getGeminiModel(), [])
  const metrics = useMemo(() => buildSceneMetrics(sceneGraph), [sceneGraph])

  const handleFileSelected = (file) => {
    if (isDemoMode) {
      setSceneGraph(createEmptySceneGraph())
      setRawJson('')
      setResponseSource('demo-ready')
    }

    setSelectedFile(file)
    setErrorMessage('')
    if (!isDemoMode) {
      setResponseSource('idle')
    }
  }

  const handleReset = () => {
    setIsDemoMode(false)
    setSelectedFile(null)
    setSceneGraph(createEmptySceneGraph())
    setRawJson('')
    setErrorMessage('')
    setResponseSource('idle')
  }

  const handleToggleDemoMode = () => {
    if (isDemoMode) {
      setIsDemoMode(false)
      setSceneGraph(createEmptySceneGraph())
      setRawJson('')
      setErrorMessage('')
      setResponseSource('idle')
      return
    }

    setIsDemoMode(true)
    setSceneGraph(createEmptySceneGraph())
    setRawJson('')
    setErrorMessage('')
    setResponseSource(selectedFile ? 'demo-ready' : 'idle')
  }

  const handleAnalyze = async () => {
    if (!selectedFile || isLoading) {
      return
    }

    setIsLoading(true)
    setErrorMessage('')
    setResponseSource('processing')

    try {
      if (isDemoMode) {
        await new Promise((resolve) => {
          window.setTimeout(resolve, DEMO_ANALYSIS_DELAY_MS)
        })

        setRawJson(DEMO_SCENE_RAW_JSON)
        setSceneGraph(DEMO_SCENE_GRAPH)
        setResponseSource('demo')
        return
      }

      const analysis = await analyzeFloorPlanImage(selectedFile)
      const normalizedScene = normalizeSceneGraph(analysis.parsedJson)

      setRawJson(analysis.rawText)
      setSceneGraph(normalizedScene)
      setResponseSource(analysis.source)
    } catch (error) {
      console.error('[FloorGPT] Analysis failed.', error)

      const isGeminiFailure = error instanceof Error && error.name === 'GeminiRequestError'
      if (isGeminiFailure) {
        console.info(
          '[FloorGPT] Inspect window.__floorGptGeminiDebug in the browser console for the latest Gemini diagnostics.',
        )
      }

      setErrorMessage(
        error instanceof Error
          ? isGeminiFailure
            ? `${error.message} See browser console for detailed Gemini logs.`
            : error.message
          : 'Could not parse the floor plan image.',
      )
      setResponseSource('error')
    } finally {
      setIsLoading(false)
    }
  }

  const sourceLabel =
    responseSource === 'gemini'
      ? 'Gemini response'
      : responseSource === 'demo'
        ? 'Demo scene'
      : responseSource === 'demo-ready'
        ? 'Demo armed'
      : responseSource === 'mock'
        ? 'Mock response'
        : responseSource === 'processing'
          ? 'Analyzing…'
          : responseSource === 'error'
            ? 'Error state'
            : 'Waiting for upload'

  return (
    <main className="min-h-screen bg-[radial-gradient(75%_60%_at_20%_0%,rgba(34,211,238,0.12),transparent_60%),radial-gradient(80%_80%_at_100%_0%,rgba(45,212,191,0.08),transparent_60%),#020617]">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header className="panel p-6 sm:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl space-y-3">
              <span className="status-chip border-cyan-500/35 bg-cyan-500/10 text-cyan-200">
                <Sparkles size={14} />
                ENCT 201 semester prototype
              </span>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-slate-100 sm:text-4xl">
                  FloorGPT
                </h1>
                <p className="mt-2 text-sm text-slate-300 sm:text-base">
                  Upload a floor plan image, parse it into structured spatial JSON, and preview a
                  generated 3D building scene in real time.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Rooms</p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">{metrics.roomCount}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Walls</p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">{metrics.wallCount}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-right">
                <p className="text-xs uppercase tracking-wide text-slate-400">Area (m²)</p>
                <p className="mt-1 text-2xl font-semibold text-slate-100">{metrics.totalArea}</p>
              </div>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <span className="status-chip">
              <BrainCircuit size={14} />
              {hasApiKey ? `Gemini live (${geminiModel})` : 'Mock mode (set API key in .env.local)'}
            </span>
            <span className="status-chip">
              <Database size={14} />
              {sourceLabel}
            </span>
            <span className="status-chip border-emerald-500/30 bg-emerald-500/10 text-emerald-200">
              <CheckCircle2 size={14} />
              Prototype ready
            </span>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-4">
            <UploadPanel
              selectedFile={selectedFile}
              isLoading={isLoading}
              isDemoMode={isDemoMode}
              hasApiKey={hasApiKey}
              modelName={geminiModel}
              errorMessage={errorMessage}
              onFileSelected={handleFileSelected}
              onAnalyze={handleAnalyze}
              onToggleDemoMode={handleToggleDemoMode}
              onReset={handleReset}
            />

            <section className="panel p-5">
              <h2 className="panel-title">Roadmap progress</h2>
              <p className="panel-subtitle mt-1">
                Structured delivery keeps the build aligned with your semester milestones.
              </p>
              <ul className="mt-4 space-y-3">
                {PHASE_ROADMAP.map((phase) => (
                  <li
                    key={phase.name}
                    className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-100">{phase.name}</p>
                      <p className="text-xs text-slate-400">{phase.label}</p>
                    </div>
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                        phase.status === 'active'
                          ? 'bg-cyan-500/15 text-cyan-200'
                          : phase.status === 'completed'
                            ? 'bg-emerald-500/15 text-emerald-200'
                            : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {phase.status === 'active'
                        ? 'In progress'
                        : phase.status === 'completed'
                          ? 'Done'
                          : 'Queued'}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          <div className="lg:col-span-8">
            <Suspense fallback={<ViewerLoadingFallback />}>
              <ViewerPanel sceneGraph={sceneGraph} isLoading={isLoading} />
            </Suspense>
          </div>
        </section>

        <JsonPreview rawJson={rawJson} parsedJson={sceneGraph} isLoading={isLoading} />
      </div>

      {isLoading ? <LoadingScreen message="Analyzing floor plan and rebuilding 3D scene…" /> : null}
    </main>
  )
}

export default App
