export function clampNormalizedPosition(value) {
  if (!Number.isFinite(value)) {
    return 0.5
  }

  if (value < 0) {
    return 0
  }

  if (value > 1) {
    return 1
  }

  return value
}

export function getOpeningDimensions(width, height = 2.1) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : 0.9
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 2.1

  return {
    width: safeWidth,
    height: safeHeight,
  }
}