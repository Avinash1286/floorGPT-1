import { createMockSceneGraph } from '../utils/sceneBuilder'

export const DEFAULT_GEMINI_MODEL = 'gemini-3.1-pro-preview'
const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models'
const REQUEST_TIMEOUT_MS = 45000
const GEMINI_DEBUG_ENABLED =
  import.meta.env.DEV || String(import.meta.env.VITE_GEMINI_DEBUG ?? '').toLowerCase() === 'true'
const GEMINI_DEBUG_KEY = '__floorGptGeminiDebug'

const SPACE_AUDIT_PROMPT = `Audit this floor plan image and return ONLY valid JSON.

Schema:
{
  "estimatedRoomCount": 0,
  "spaces": [
    { "label": "Lounge", "kind": "room" }
  ]
}

Rules:
- List every clearly visible labeled enclosed space or named area.
- Keep labels as written on the plan.
- Include utility and circulation spaces if labeled: Verandah, Pantry, T/B, Entrance, Dining, Lounge, Open Kitchen, Bedroom, Ch.Bedroom, etc.
- If multiple spaces share the same label, include each occurrence separately.
- estimatedRoomCount must reflect the total number of visible labeled spaces.
- Return JSON only.`

const EXTERIOR_STYLE_PROMPT = `Analyze the uploaded image for architectural reference cues and return ONLY valid JSON.

If the image includes a rendered or photographed house exterior, infer a procedural style profile for a 3D reconstruction.
If no exterior reference is visible, set hasExteriorReference to false and keep confidence low.

Schema:
{
  "hasExteriorReference": true,
  "confidence": 0.0,
  "referenceSummary": "modern two-level flat-roof house with carport and balcony",
  "palette": {
    "base": "#F8FAFC",
    "accent": "#475569",
    "trim": "#CBD5E1",
    "roof": "#334155",
    "glass": "#BFDBFE",
    "hardscape": "#D6D3D1",
    "landscape": "#7CB342"
  },
  "massing": {
    "upperLevel": true,
    "upperLevelWidthFactor": 0.52,
    "upperLevelDepthFactor": 0.34,
    "upperLevelOffsetX": 0.18,
    "upperLevelOffsetZ": -0.08,
    "upperLevelHeight": 2.9
  },
  "facade": {
    "columnCount": 4,
    "columnWidth": 0.24,
    "columnStyle": "banded-square",
    "canopyDepth": 1.9,
    "balcony": true,
    "balconyWidthFactor": 0.52,
    "balconyDepth": 1.35,
    "frontWindowColumns": 3,
    "railingPattern": "horizontal-bars",
    "sideScreen": true,
    "parapetProfile": "capped",
    "accentWallSide": "east",
    "accentWallWidth": 0.9,
    "accentWallDepth": 0.24,
    "steps": 4,
    "hasFacadeBands": true,
    "carport": true,
    "terrace": true,
    "railing": true
  },
  "interior": {
    "theme": "modern clean",
    "furnishingDensity": "high"
  }
}

Rules:
- If the top or side of the image shows an exterior reference render, use it.
- Ignore the floor plan when inferring exterior colors and facade composition.
- confidence must be between 0 and 1.
- Use hex colors.
- Prefer flat-roof modern detailing when the exterior render shows parapets, balcony rails, carport slabs, and linear window bands.
- upperLevelWidthFactor and upperLevelDepthFactor must be between 0.25 and 0.85.
- upperLevelOffsetX and upperLevelOffsetZ must be between -0.35 and 0.35.
- columnCount must be between 0 and 6.
- If unsure, choose conservative modern-flat-roof defaults instead of inventing ornate details.
- Return JSON only. No markdown, no explanation.`

class GeminiRequestError extends Error {
  constructor(message, details = {}, cause) {
    super(message)
    this.name = 'GeminiRequestError'
    this.details = details

    if (cause) {
      this.cause = cause
    }
  }
}

export function getGeminiModel() {
  const configuredModel = import.meta.env.VITE_GEMINI_MODEL

  if (typeof configuredModel === 'string' && configuredModel.trim()) {
    return configuredModel.trim()
  }

  return DEFAULT_GEMINI_MODEL
}

function buildGeminiEndpoint(model) {
  return `${GEMINI_BASE_URL}/${encodeURIComponent(model)}:generateContent`
}

function createRequestId() {
  return `gemini-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function truncateText(text, maxLength = 1800) {
  if (typeof text !== 'string' || !text.trim()) {
    return ''
  }

  const normalized = text.trim()
  if (normalized.length <= maxLength) {
    return normalized
  }

  return `${normalized.slice(0, maxLength)}... [truncated ${normalized.length - maxLength} chars]`
}

function serializeError(error) {
  if (!(error instanceof Error)) {
    return error
  }

  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...(error.cause ? { cause: serializeError(error.cause) } : {}),
  }
}

function getResponseHeaders(response) {
  return Object.fromEntries(response.headers.entries())
}

function writeGeminiDebugEntry(entry) {
  if (typeof globalThis === 'undefined') {
    return
  }

  const previous = globalThis[GEMINI_DEBUG_KEY] ?? { history: [] }
  const history = [...(previous.history ?? []), entry].slice(-10)

  globalThis[GEMINI_DEBUG_KEY] = {
    ...previous,
    lastEvent: entry,
    history,
    ...(entry.status === 'failed' ? { lastFailure: entry } : {}),
    ...(entry.status === 'succeeded' ? { lastSuccess: entry } : {}),
  }
}

function logGeminiEvent(title, details, { level = 'info', force = false } = {}) {
  if (!force && !GEMINI_DEBUG_ENABLED) {
    return
  }

  const logger =
    typeof console[level] === 'function' ? console[level].bind(console) : console.log.bind(console)

  if (typeof console.groupCollapsed === 'function') {
    console.groupCollapsed(`[FloorGPT][Gemini] ${title}`)
    logger(details)
    console.groupEnd()
    return
  }

  logger(`[FloorGPT][Gemini] ${title}`, details)
}

function logGeminiFailure(title, details, error) {
  const entry = {
    title,
    status: 'failed',
    timestamp: new Date().toISOString(),
    details,
    error: serializeError(error),
  }

  writeGeminiDebugEntry(entry)

  if (typeof console.group === 'function') {
    console.group(`[FloorGPT][Gemini] ${title}`)
    console.error(error)
    console.log(details)
    console.groupEnd()
    return
  }

  console.error(`[FloorGPT][Gemini] ${title}`, error, details)
}

function logGeminiSuccess(title, details) {
  const entry = {
    title,
    status: 'succeeded',
    timestamp: new Date().toISOString(),
    details,
  }

  writeGeminiDebugEntry(entry)
  logGeminiEvent(title, details)
}

function createGeminiError(message, details = {}, cause) {
  return new GeminiRequestError(message, details, cause)
}

function buildFloorPlanPrompt({
  visibleSpaceLabels = [],
  minimumRoomCount = 0,
  missingLabels = [],
} = {}) {
  const visibleLabelsBlock = visibleSpaceLabels.length
    ? `The plan visibly contains these labeled spaces, and your rooms array must include all of them as separate entries unless a label is completely unreadable:
${JSON.stringify(visibleSpaceLabels)}`
    : 'The rooms array must include every clearly visible labeled space in the floor plan.'

  const retryBlock = missingLabels.length
    ? `Previous extraction missed these labels, so pay special attention to them:
${JSON.stringify(missingLabels)}`
    : ''

  const minimumRoomBlock =
    minimumRoomCount > 1
      ? `metadata.roomCount must be at least ${minimumRoomCount}, unless the image truly contains fewer labeled spaces.`
      : ''

  return `You are extracting a complete floor plan scene graph. Return ONLY valid JSON.

${visibleLabelsBlock}
${retryBlock}

Schema:
{
  "scale": "1 unit = 1 meter (estimate)",
  "rooms": [
    {
      "id": "room_1",
      "name": "Living Room",
      "x": 0,
      "y": 0,
      "width": 5.0,
      "height": 4.0,
      "color": "#E8D5B7"
    }
  ],
  "walls": [
    { "x1": 0, "y1": 0, "x2": 5, "y2": 0, "thickness": 0.2 }
  ],
  "doors": [
    { "room_id": "room_1", "wall": "south", "position": 0.5, "width": 0.9 }
  ],
  "windows": [
    { "room_id": "room_1", "wall": "east", "position": 0.3, "width": 1.2 }
  ],
  "metadata": {
    "floors": 1,
    "roomCount": 0
  }
}

Rules:
- Use ONE shared 2D coordinate system for the full plan.
- rooms must include every clearly visible labeled space from the plan.
- Keep room names as written on the plan when possible.
- It is invalid to return only one room when multiple labeled spaces are visible.
- Duplicate room names are allowed.
- Estimate x, y, width, and height from the plan labels, dimension strings, and wall extents.
- If room dimensions are printed on the plan, use them directly for width and height when possible.
- If the drawing uses meters, keep the scene in meters. If the unit is unclear, infer a realistic residential metric scale.
- walls must describe the complete visible wall network, including interior partitions, not just the exterior boundary.
- Align shared walls between adjacent rooms so neighboring room edges line up exactly.
- doors and windows can be approximate, but rooms must be exhaustive.
- metadata.roomCount must equal rooms.length.
- ${minimumRoomBlock || 'Infer scale reasonably when not explicitly present.'}
- Return JSON only. No markdown, no explanation.`
}

function stripMarkdownCodeFences(text) {
  const trimmed = text.trim()
  if (!trimmed.startsWith('```')) {
    return trimmed
  }

  return trimmed.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim()
}

function extractFirstJsonObject(text) {
  const source = text.trim()
  const start = source.indexOf('{')

  if (start < 0) {
    return ''
  }

  let depth = 0
  let inString = false
  let escaping = false

  for (let index = start; index < source.length; index += 1) {
    const char = source[index]

    if (inString) {
      if (escaping) {
        escaping = false
        continue
      }

      if (char === '\\') {
        escaping = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      depth += 1
      continue
    }

    if (char === '}') {
      depth -= 1

      if (depth === 0) {
        return source.slice(start, index + 1)
      }
    }
  }

  return ''
}

function repairJsonString(text) {
  return text
    .replace(/^\uFEFF/, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/,\s*([}\]])/g, '$1')
    .trim()
}

function parseStructuredJson(rawText) {
  const cleanText = rawText.trim()
  const fenceStripped = stripMarkdownCodeFences(cleanText)
  const extractedObject = extractFirstJsonObject(fenceStripped)

  const parseCandidates = [cleanText, fenceStripped, extractedObject]
    .filter(Boolean)
    .map((candidate) => candidate.trim())
  const uniqueCandidates = [...new Set(parseCandidates)]

  for (const candidate of uniqueCandidates) {
    try {
      return JSON.parse(candidate)
    } catch {
      try {
        return JSON.parse(repairJsonString(candidate))
      } catch {
        // Continue trying alternatives.
      }
    }
  }

  throw new Error('Gemini returned invalid JSON. Try a clearer floor plan or retry once.')
}

function parseSpaceAudit(rawText) {
  const payload = parseStructuredJson(rawText)
  const spaces = Array.isArray(payload?.spaces)
    ? payload.spaces
        .map((space) => ({
          label: typeof space?.label === 'string' ? space.label.trim() : '',
          kind: typeof space?.kind === 'string' ? space.kind.trim() : 'room',
        }))
        .filter((space) => space.label)
    : []

  const estimatedRoomCount = Number(payload?.estimatedRoomCount)

  return {
    estimatedRoomCount:
      Number.isFinite(estimatedRoomCount) && estimatedRoomCount > 0 ? estimatedRoomCount : spaces.length,
    spaces,
  }
}

function clampNumber(value, min, max, fallback) {
  const numberValue = Number(value)

  if (!Number.isFinite(numberValue)) {
    return fallback
  }

  return Math.min(Math.max(numberValue, min), max)
}

function parseStyleProfile(rawText) {
  const payload = parseStructuredJson(rawText)
  const palette = payload?.palette && typeof payload.palette === 'object' ? payload.palette : {}
  const massing = payload?.massing && typeof payload.massing === 'object' ? payload.massing : {}
  const facade = payload?.facade && typeof payload.facade === 'object' ? payload.facade : {}
  const interior = payload?.interior && typeof payload.interior === 'object' ? payload.interior : {}

  return {
    hasExteriorReference: Boolean(payload?.hasExteriorReference),
    confidence: clampNumber(payload?.confidence, 0, 1, 0),
    referenceSummary:
      typeof payload?.referenceSummary === 'string' ? payload.referenceSummary.trim() : '',
    palette,
    massing: {
      upperLevel: Boolean(massing?.upperLevel),
      upperLevelWidthFactor: clampNumber(massing?.upperLevelWidthFactor, 0.25, 0.85, 0.52),
      upperLevelDepthFactor: clampNumber(massing?.upperLevelDepthFactor, 0.25, 0.85, 0.34),
      upperLevelOffsetX: clampNumber(massing?.upperLevelOffsetX, -0.35, 0.35, 0.14),
      upperLevelOffsetZ: clampNumber(massing?.upperLevelOffsetZ, -0.35, 0.35, -0.08),
      upperLevelHeight: clampNumber(massing?.upperLevelHeight, 2.2, 3.8, 2.9),
    },
    facade: {
      columnCount: clampNumber(facade?.columnCount, 0, 6, 4),
      columnWidth: clampNumber(facade?.columnWidth, 0.16, 0.5, 0.24),
      columnStyle: typeof facade?.columnStyle === 'string' ? facade.columnStyle.trim().toLowerCase() : 'banded-square',
      canopyDepth: clampNumber(facade?.canopyDepth, 0.8, 3.2, 1.9),
      balcony: Boolean(facade?.balcony),
      balconyWidthFactor: clampNumber(facade?.balconyWidthFactor, 0.2, 0.9, 0.52),
      balconyDepth: clampNumber(facade?.balconyDepth, 0.7, 2.4, 1.35),
      frontWindowColumns: clampNumber(facade?.frontWindowColumns, 2, 5, 3),
      railingPattern:
        typeof facade?.railingPattern === 'string' && facade.railingPattern.trim().toLowerCase() === 'posts'
          ? 'posts'
          : 'horizontal-bars',
      sideScreen: typeof facade?.sideScreen === 'boolean' ? facade.sideScreen : true,
      parapetProfile:
        typeof facade?.parapetProfile === 'string' && facade.parapetProfile.trim().toLowerCase() === 'flush'
          ? 'flush'
          : 'capped',
      accentWallSide:
        typeof facade?.accentWallSide === 'string' ? facade.accentWallSide.trim().toLowerCase() : 'east',
      accentWallWidth: clampNumber(facade?.accentWallWidth, 0.3, 2.2, 0.9),
      accentWallDepth: clampNumber(facade?.accentWallDepth, 0.1, 0.7, 0.24),
      steps: clampNumber(facade?.steps, 0, 8, 4),
      hasFacadeBands: Boolean(facade?.hasFacadeBands),
      carport: Boolean(facade?.carport),
      terrace: Boolean(facade?.terrace),
      railing: Boolean(facade?.railing),
    },
    interior: {
      theme: typeof interior?.theme === 'string' ? interior.theme.trim() : '',
      furnishingDensity:
        typeof interior?.furnishingDensity === 'string' ? interior.furnishingDensity.trim().toLowerCase() : '',
    },
  }
}

function normalizeLabelForMatch(label) {
  return String(label ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim()
}

function countLabels(labels) {
  return labels.reduce((counts, label) => {
    const normalized = normalizeLabelForMatch(label)
    if (!normalized) {
      return counts
    }

    counts.set(normalized, (counts.get(normalized) ?? 0) + 1)
    return counts
  }, new Map())
}

function assessSceneCoverage(parsedJson, visibleSpaceLabels) {
  const expectedCounts = countLabels(visibleSpaceLabels)
  const actualCounts = countLabels((parsedJson?.rooms ?? []).map((room) => room?.name))
  const missingLabels = []

  expectedCounts.forEach((expectedCount, normalizedLabel) => {
    const actualCount = actualCounts.get(normalizedLabel) ?? 0
    const missingCount = expectedCount - actualCount

    if (missingCount > 0) {
      for (let index = 0; index < missingCount; index += 1) {
        const label = visibleSpaceLabels.find(
          (candidate) => normalizeLabelForMatch(candidate) === normalizedLabel,
        )
        missingLabels.push(label ?? normalizedLabel)
      }
    }
  })

  return {
    expectedCount: visibleSpaceLabels.length,
    actualCount: (parsedJson?.rooms ?? []).length,
    missingLabels,
    hasCoverageGap: missingLabels.length > 0,
  }
}

function createAbortController(parentSignal) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort(new Error('Gemini request timed out. Please try again.'))
  }, REQUEST_TIMEOUT_MS)

  const onParentAbort = () => {
    controller.abort(parentSignal?.reason ?? new Error('Request cancelled.'))
  }

  if (parentSignal) {
    if (parentSignal.aborted) {
      onParentAbort()
    } else {
      parentSignal.addEventListener('abort', onParentAbort, { once: true })
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId)

      if (parentSignal) {
        parentSignal.removeEventListener('abort', onParentAbort)
      }
    },
  }
}

function toInlineData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : ''
      const base64 = result.split(',')[1]

      if (!base64) {
        reject(new Error('Could not read image data from the uploaded file.'))
        return
      }

      resolve({
        mimeType: file.type || 'image/png',
        data: base64,
      })
    }

    reader.onerror = () => reject(new Error('Failed to load the selected image file.'))
    reader.readAsDataURL(file)
  })
}

function extractCandidateText(payload) {
  const candidate = payload?.candidates?.[0]
  if (!candidate) {
    const blockReason = payload?.promptFeedback?.blockReason
    if (blockReason) {
      throw createGeminiError(`Gemini blocked this request (${blockReason}). Try another image.`, {
        phase: 'candidate-extraction',
        promptFeedback: payload?.promptFeedback ?? null,
        payload,
      })
    }

    throw createGeminiError('Gemini returned no candidates. Please retry the request.', {
      phase: 'candidate-extraction',
      promptFeedback: payload?.promptFeedback ?? null,
      payload,
    })
  }

  if (candidate.finishReason === 'SAFETY') {
    throw createGeminiError('Gemini safety filters blocked this response. Try a different input image.', {
      phase: 'candidate-extraction',
      finishReason: candidate.finishReason,
      safetyRatings: candidate.safetyRatings ?? null,
      promptFeedback: payload?.promptFeedback ?? null,
      payload,
    })
  }

  const text = candidate.content?.parts
    ?.map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('\n')
    .trim()

  if (!text) {
    throw createGeminiError('Gemini response was empty. Try a clearer floor plan image.', {
      phase: 'candidate-extraction',
      finishReason: candidate.finishReason ?? null,
      candidate,
      payload,
    })
  }

  return text
}

function buildRequestSummary({ requestId, endpoint, model, inlineData, file, promptText, stage }) {
  return {
    requestId,
    stage,
    endpoint,
    model,
    timeoutMs: REQUEST_TIMEOUT_MS,
    fileName: file?.name ?? '',
    fileSizeBytes: Number(file?.size) || 0,
    mimeType: inlineData?.mimeType ?? file?.type ?? 'image/png',
    imageBase64Length: inlineData?.data?.length ?? 0,
    promptLength: promptText.length,
    promptPreview: truncateText(promptText, 480),
  }
}

function buildResponseSummary(response, payload, responseText, elapsedMs) {
  return {
    elapsedMs,
    httpStatus: response.status,
    httpStatusText: response.statusText,
    headers: getResponseHeaders(response),
    promptFeedback: payload?.promptFeedback ?? null,
    error: payload?.error ?? null,
    candidateCount: Array.isArray(payload?.candidates) ? payload.candidates.length : 0,
    finishReasons: Array.isArray(payload?.candidates)
      ? payload.candidates.map((candidate) => candidate?.finishReason ?? 'unknown')
      : [],
    responsePreview: truncateText(responseText),
  }
}

function normalizeGeminiFailure(error, fallbackDetails) {
  if (error instanceof GeminiRequestError) {
    return error
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return createGeminiError(
      'Gemini request timed out. Please retry with a clearer image.',
      fallbackDetails,
      error,
    )
  }

  if (error instanceof Error) {
    return createGeminiError(error.message, fallbackDetails, error)
  }

  return createGeminiError('Unexpected Gemini request failure.', fallbackDetails)
}

async function requestGemini(apiKey, model, inlineData, signal, file, requestId, promptText, stage) {
  const endpoint = buildGeminiEndpoint(model)
  const { signal: requestSignal, cleanup } = createAbortController(signal)
  const requestSummary = buildRequestSummary({
    requestId,
    endpoint,
    model,
    inlineData,
    file,
    promptText,
    stage,
  })
  const startedAt = performance.now()

  logGeminiEvent('Request start', requestSummary)

  try {
    const response = await fetch(`${endpoint}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: requestSignal,
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: promptText }, { inlineData }],
          },
        ],
        generationConfig: {
          temperature: 0.05,
          responseMimeType: 'application/json',
        },
      }),
    })

    const responseText = await response.text()
    let payload = {}

    if (responseText.trim()) {
      try {
        payload = JSON.parse(responseText)
      } catch {
        payload = {}
      }
    }

    const responseSummary = buildResponseSummary(
      response,
      payload,
      responseText,
      Number((performance.now() - startedAt).toFixed(1)),
    )

    if (!response.ok) {
      const apiError =
        payload?.error?.message ?? truncateText(responseText, 320) ?? 'Gemini API request failed.'
      throw createGeminiError(
        `Gemini API request failed (${response.status} ${response.statusText}): ${apiError}`,
        {
          phase: 'http-response',
          request: requestSummary,
          response: responseSummary,
          payload,
        },
      )
    }

    const rawText = extractCandidateText(payload)

    logGeminiSuccess('Request success', {
      request: requestSummary,
      response: responseSummary,
      rawTextPreview: truncateText(rawText, 1000),
    })

    return rawText
  } catch (error) {
    const normalizedError = normalizeGeminiFailure(error, {
      phase: 'request',
      request: requestSummary,
    })
    logGeminiFailure('Request failure', normalizedError.details, normalizedError)
    throw normalizedError
  } finally {
    cleanup()
  }
}

export async function analyzeFloorPlanImage(
  file,
  {
    apiKey = import.meta.env.VITE_GEMINI_API_KEY,
    model = getGeminiModel(),
    signal,
  } = {},
) {
  if (!file) {
    throw new Error('Please upload a floor plan image before analysis.')
  }

  if (!apiKey) {
    const mockScene = createMockSceneGraph(file.name)
    return {
      source: 'mock',
      rawText: JSON.stringify(mockScene, null, 2),
      parsedJson: mockScene,
      model,
    }
  }

  const requestId = createRequestId()
  const inlineData = await toInlineData(file)
  let visibleSpaceLabels = []

  try {
    const auditRawText = await requestGemini(
      apiKey,
      model,
      inlineData,
      signal,
      file,
      requestId,
      SPACE_AUDIT_PROMPT,
      'space-audit',
    )
    const audit = parseSpaceAudit(auditRawText)
    visibleSpaceLabels = audit.spaces.map((space) => space.label)

    logGeminiEvent('Space audit summary', {
      requestId,
      fileName: file.name,
      estimatedRoomCount: audit.estimatedRoomCount,
      visibleSpaceLabels,
    })
  } catch (error) {
    const normalizedAuditError = normalizeGeminiFailure(error, {
      phase: 'space-audit',
      requestId,
      fileName: file.name,
    })

    logGeminiEvent(
      'Space audit fallback',
      {
        requestId,
        fileName: file.name,
        reason: normalizedAuditError.message,
      },
      { force: true, level: 'warn' },
    )
  }

  let rawText = await requestGemini(
    apiKey,
    model,
    inlineData,
    signal,
    file,
    requestId,
    buildFloorPlanPrompt({
      visibleSpaceLabels,
      minimumRoomCount: visibleSpaceLabels.length,
    }),
    'scene-parse',
  )

  let parsedJson

  try {
    parsedJson = parseStructuredJson(rawText)
  } catch (error) {
    const normalizedError =
      error instanceof GeminiRequestError
        ? error
        : createGeminiError(
            error instanceof Error
              ? error.message
              : 'Gemini returned an unparseable response.',
            {
              phase: 'json-parse',
              requestId,
              model,
              fileName: file.name,
              rawTextLength: rawText.length,
              rawTextPreview: truncateText(rawText),
            },
            error instanceof Error ? error : undefined,
          )

    logGeminiFailure('Response parsing failure', normalizedError.details, normalizedError)
    throw normalizedError
  }

  const coverage = assessSceneCoverage(parsedJson, visibleSpaceLabels)

  if (coverage.hasCoverageGap && visibleSpaceLabels.length > 1) {
    logGeminiEvent(
      'Coverage gap detected, retrying scene parse',
      {
        requestId,
        expectedCount: coverage.expectedCount,
        actualCount: coverage.actualCount,
        missingLabels: coverage.missingLabels,
      },
      { force: true, level: 'warn' },
    )

    rawText = await requestGemini(
      apiKey,
      model,
      inlineData,
      signal,
      file,
      requestId,
      buildFloorPlanPrompt({
        visibleSpaceLabels,
        minimumRoomCount: visibleSpaceLabels.length,
        missingLabels: coverage.missingLabels,
      }),
      'scene-parse-retry',
    )

    try {
      parsedJson = parseStructuredJson(rawText)
    } catch (error) {
      const normalizedRetryError =
        error instanceof GeminiRequestError
          ? error
          : createGeminiError(
              error instanceof Error
                ? error.message
                : 'Gemini returned an unparseable response on retry.',
              {
                phase: 'json-parse-retry',
                requestId,
                model,
                fileName: file.name,
                rawTextLength: rawText.length,
                rawTextPreview: truncateText(rawText),
              },
              error instanceof Error ? error : undefined,
            )

      logGeminiFailure('Retry response parsing failure', normalizedRetryError.details, normalizedRetryError)
      throw normalizedRetryError
    }
  }

  let styleProfile = null

  try {
    const styleRawText = await requestGemini(
      apiKey,
      model,
      inlineData,
      signal,
      file,
      requestId,
      EXTERIOR_STYLE_PROMPT,
      'style-profile',
    )
    styleProfile = parseStyleProfile(styleRawText)

    logGeminiEvent('Exterior style summary', {
      requestId,
      fileName: file.name,
      hasExteriorReference: styleProfile.hasExteriorReference,
      confidence: styleProfile.confidence,
      referenceSummary: styleProfile.referenceSummary,
    })
  } catch (error) {
    const normalizedStyleError = normalizeGeminiFailure(error, {
      phase: 'style-profile',
      requestId,
      fileName: file.name,
    })

    logGeminiEvent(
      'Exterior style fallback',
      {
        requestId,
        fileName: file.name,
        reason: normalizedStyleError.message,
      },
      { force: true, level: 'warn' },
    )
  }

  const mergedScene = styleProfile ? { ...parsedJson, style: styleProfile } : parsedJson

  return {
    source: 'gemini',
    rawText: JSON.stringify(mergedScene, null, 2),
    parsedJson: mergedScene,
    model,
  }
}
