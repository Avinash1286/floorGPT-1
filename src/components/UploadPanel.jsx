import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, FileImage, ImagePlus, Loader2, ScanLine, Trash2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

function formatBytes(bytes = 0) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  const size = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / 1024 ** size
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[size]}`
}

function UploadPanel({
  selectedFile,
  isLoading,
  isDemoMode,
  hasApiKey,
  modelName,
  errorMessage,
  onFileSelected,
  onAnalyze,
  onToggleDemoMode,
  onReset,
}) {
  const [dropError, setDropError] = useState('')

  const previewUrl = useMemo(
    () => (selectedFile ? URL.createObjectURL(selectedFile) : ''),
    [selectedFile],
  )

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    },
    [previewUrl],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
    multiple: false,
    onDropAccepted: (files) => {
      if (!files.length) {
        return
      }

      setDropError('')
      onFileSelected(files[0])
    },
    onDropRejected: (fileRejections) => {
      const firstError = fileRejections[0]?.errors?.[0]

      if (firstError?.code === 'file-too-large') {
        setDropError('File is too large. Maximum size is 10MB.')
        return
      }

      if (firstError?.code === 'file-invalid-type') {
        setDropError('Unsupported file type. Please upload PNG, JPG, or WEBP.')
        return
      }

      setDropError('This file could not be uploaded. Please try a different image.')
    },
  })

  const canAnalyze = Boolean(selectedFile) && !isLoading

  return (
    <section className="panel p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="panel-title">Upload floor plan</h2>
          <p className="panel-subtitle mt-1">
            Drop a blueprint image to start the image-to-scene pipeline.
          </p>
        </div>

        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
            hasApiKey ? 'bg-emerald-500/15 text-emerald-200' : 'bg-amber-500/15 text-amber-200'
          }`}
          title={hasApiKey ? modelName : 'Mock fallback active'}
        >
          {hasApiKey ? modelName : 'Mock fallback'}
        </span>
      </div>

      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-2xl border border-dashed p-5 text-center transition ${
          isDragActive
            ? 'border-cyan-400 bg-cyan-500/10'
            : 'border-slate-700 bg-slate-950/70 hover:border-slate-500 hover:bg-slate-900'
        }`}
      >
        <input {...getInputProps()} />
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-800 text-slate-200">
          <ImagePlus size={20} />
        </div>
        <p className="text-sm font-medium text-slate-100">
          {isDragActive ? 'Drop the image here' : 'Drag and drop a floor plan image'}
        </p>
        <p className="mt-1 text-xs text-slate-400">PNG, JPG, WEBP up to 10MB</p>
      </div>

      {selectedFile ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-800 bg-slate-950/70">
          {previewUrl ? (
            <img src={previewUrl} alt="Floor plan preview" className="h-36 w-full object-cover" />
          ) : null}
          <div className="flex items-center justify-between gap-3 p-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-100">{selectedFile.name}</p>
              <p className="mt-0.5 text-xs text-slate-400">{formatBytes(selectedFile.size)}</p>
            </div>
            <FileImage size={18} className="shrink-0 text-slate-400" />
          </div>
        </div>
      ) : null}

      {dropError || errorMessage ? (
        <div className="mt-4 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          <p className="flex items-start gap-2">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{dropError || errorMessage}</span>
          </p>
        </div>
      ) : null}

      {!hasApiKey ? (
        <div className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Add <span className="font-semibold">VITE_GEMINI_API_KEY</span> in .env.local for live
          Gemini parsing. You can override the model with{' '}
          <span className="font-semibold">VITE_GEMINI_MODEL</span>.
        </div>
      ) : null}

      {isDemoMode ? (
        <div className="mt-4 rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100">
          Demo mode is active. Upload an image and click Analyze floor plan to simulate a 3-second
          response with the bundled sample scene.
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" className="btn-primary flex-1" onClick={onAnalyze} disabled={!canAnalyze}>
          {isLoading ? <Loader2 size={16} className="animate-spin" /> : <ScanLine size={16} />}
          {isLoading ? 'Analyzing...' : 'Analyze floor plan'}
        </button>
        <button
          type="button"
          className={`btn-secondary ${isDemoMode ? '!border-cyan-500/50 !text-cyan-200' : ''}`}
          onClick={onToggleDemoMode}
          disabled={isLoading}
        >
          <FileImage size={16} />
          {isDemoMode ? 'Disable demo' : 'Enable demo'}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onReset}
          disabled={isLoading && !selectedFile && !isDemoMode}
        >
          <Trash2 size={16} />
          Reset
        </button>
      </div>
    </section>
  )
}

export default UploadPanel
