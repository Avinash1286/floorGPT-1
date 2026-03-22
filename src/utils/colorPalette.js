const ROOM_COLORS = [
  '#38BDF8',
  '#34D399',
  '#F59E0B',
  '#F472B6',
  '#A78BFA',
  '#F87171',
  '#2DD4BF',
]

const ROOM_NAME_COLOR_RULES = [
  { pattern: /living/i, color: '#38BDF8' },
  { pattern: /kitchen/i, color: '#F59E0B' },
  { pattern: /bed/i, color: '#A78BFA' },
  { pattern: /bath/i, color: '#2DD4BF' },
  { pattern: /office|study/i, color: '#34D399' },
]

export function getRoomColor(roomName, index = 0, explicitColor = '') {
  if (typeof explicitColor === 'string' && explicitColor.trim()) {
    return explicitColor.trim()
  }

  if (typeof roomName === 'string' && roomName.trim()) {
    const matchedRule = ROOM_NAME_COLOR_RULES.find((rule) => rule.pattern.test(roomName))
    if (matchedRule) {
      return matchedRule.color
    }
  }

  return ROOM_COLORS[index % ROOM_COLORS.length]
}

export function withValidatedHexColor(color, fallback = '#94A3B8') {
  if (typeof color !== 'string') {
    return fallback
  }

  const trimmed = color.trim()
  return /^#(?:[0-9a-fA-F]{3}){1,2}$/.test(trimmed) ? trimmed : fallback
}