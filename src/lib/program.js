export const PROGRAM_START = '2026-03-25'
export const MORNING_BONUS_HOUR = 9

const READING_SEQUENCE = [
  { name: '에베소서', start: 1, end: 6 },
  { name: '빌립보서', start: 3, end: 4 },
  { name: '골로새서', start: 1, end: 4 },
  { name: '데살로니가전서', start: 1, end: 5 },
  { name: '데살로니가후서', start: 1, end: 3 },
  { name: '디모데전서', start: 1, end: 6 },
  { name: '디모데후서', start: 1, end: 4 },
  { name: '디도서', start: 1, end: 3 },
  { name: '빌레몬서', start: 1, end: 1 },
  { name: '히브리서', start: 1, end: 13 },
  { name: '야고보서', start: 1, end: 5 },
  { name: '베드로전서', start: 1, end: 5 },
  { name: '베드로후서', start: 1, end: 3 },
  { name: '요한일서', start: 1, end: 5 },
  { name: '요한이서', start: 1, end: 1 },
  { name: '요한삼서', start: 1, end: 1 },
]

function parseDateKey(dateKey) {
  return new Date(`${dateKey}T12:00:00`)
}

export function toDateKey(date = new Date()) {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')

  return `${year}-${month}-${day}`
}

function enumerateDates(startDate, endDate) {
  const dates = []
  const cursor = parseDateKey(startDate)
  const boundary = parseDateKey(endDate)

  while (cursor <= boundary) {
    dates.push(toDateKey(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }

  return dates
}

function buildPassages() {
  return READING_SEQUENCE.flatMap((book) => {
    const chapters = []

    for (let chapter = book.start; chapter <= book.end; chapter += 1) {
      chapters.push(`${book.name} ${chapter}장`)
    }

    return chapters
  })
}

function shiftDateKey(dateKey, offsetDays) {
  const cursor = parseDateKey(dateKey)
  cursor.setDate(cursor.getDate() + offsetDays)
  return toDateKey(cursor)
}

function formatPeriodLabel(startDate, endDate) {
  return `${startDate.replaceAll('-', '.')} - ${endDate.replaceAll('-', '.')}`
}

const PASSAGES = buildPassages()

export const PROGRAM_END = shiftDateKey(PROGRAM_START, PASSAGES.length - 1)
export const PROGRAM_LABEL = formatPeriodLabel(PROGRAM_START, PROGRAM_END)

export function buildReadingPlan() {
  const dates = enumerateDates(PROGRAM_START, PROGRAM_END)

  return dates.map((date, index) => ({
    date,
    chapter: PASSAGES[index],
    month: Number(date.slice(5, 7)),
  }))
}

export const READING_PLAN = buildReadingPlan()

export function formatDateLabel(dateKey, options = {}) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    ...options,
  }).format(parseDateKey(dateKey))
}

export function getProgramPhase(todayKeyValue) {
  if (todayKeyValue < PROGRAM_START) {
    return 'before'
  }

  if (todayKeyValue > PROGRAM_END) {
    return 'after'
  }

  return 'active'
}

export function canSubmitReading(dateKey, todayKeyValue) {
  return dateKey <= todayKeyValue
}

export function calculateReadingScore({ planDate, submittedAt }) {
  const submittedDate = new Date(submittedAt)
  const submittedDateKey = toDateKey(submittedDate)

  if (submittedDateKey === planDate) {
    return submittedDate.getHours() < MORNING_BONUS_HOUR ? 3 : 2
  }

  if (submittedDateKey > planDate) {
    return 1
  }

  return 0
}

export function getReadingStatus({ dateKey, record, todayKeyValue }) {
  if (record) {
    if (record.score >= 3) {
      return { label: '이른 완료', badgeClass: 'badge-accent', tone: 'accent' }
    }

    if (record.score === 2) {
      return {
        label: '당일 완료',
        badgeClass: 'badge-secondary',
        tone: 'secondary',
      }
    }

    return { label: '늦은 체크', badgeClass: 'badge-warning', tone: 'warning' }
  }

  if (dateKey > todayKeyValue) {
    return { label: '예정', badgeClass: 'badge-neutral', tone: 'neutral' }
  }

  if (dateKey === todayKeyValue) {
    return { label: '오늘 읽기', badgeClass: 'badge-primary', tone: 'primary' }
  }

  return { label: '미체크', badgeClass: 'badge-outline', tone: 'outline' }
}
