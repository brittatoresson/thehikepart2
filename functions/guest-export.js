function csvCell(value) {
  let text = String(value ?? '')
  // Quoting alone does not stop Excel from interpreting spreadsheet formulas.
  if (/^[\s]*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replaceAll('"', '""')}"`
}

function buildGuestCsv(users, rsvps) {
  const rows = [['Namn', 'E-post', 'Närvaro', 'Allergier / matpreferenser', 'Registrerad av']]
  const registrations = new Map(users.map(user => [user.id, user]))
  for (const [id, rsvp] of rsvps) {
    if (!registrations.has(id)) registrations.set(id, { id, displayName: rsvp.displayName })
  }
  for (const user of registrations.values()) {
    const rsvp = rsvps.get(user.id)
    const status = rsvp?.attending === true ? 'Kommer'
      : rsvp?.attending === false ? 'Kommer ej' : 'Ej svarat'
    const guests = rsvp?.attending === true && rsvp.guests?.length
      ? rsvp.guests : [{ name: user.displayName, dietary: '' }]
    for (const guest of guests) {
      rows.push([guest.name, user.email, status, guest.dietary, user.displayName])
    }
  }
  return '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n') + '\r\n'
}

module.exports = { buildGuestCsv }
