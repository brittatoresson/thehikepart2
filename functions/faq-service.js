const ID_PATTERN = /^[a-zA-Z0-9_-]{1,80}$/

function normalizeFaqs(items) {
  if (!Array.isArray(items) || items.length > 100) {
    throw new TypeError('FAQ must be an array containing at most 100 items.')
  }

  const ids = new Set()
  return items.map(item => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new TypeError('FAQ entries must be objects.')
    }
    const { id, q, a } = item
    if (typeof id !== 'string' || !ID_PATTERN.test(id) || ids.has(id)) {
      throw new TypeError('FAQ IDs must be valid and unique.')
    }
    if (typeof q !== 'string' || !q.trim() || q.trim().length > 250) {
      throw new TypeError('FAQ questions must contain 1 to 250 characters.')
    }
    if (typeof a !== 'string' || !a.trim() || a.trim().length > 4000) {
      throw new TypeError('FAQ answers must contain 1 to 4000 characters.')
    }
    ids.add(id)
    return { id, q: q.trim(), a: a.trim() }
  })
}

module.exports = { normalizeFaqs }
