import { useEffect, useState } from 'react'
import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { get, ref, remove, set } from 'firebase/database'
import { db } from './lib/firebase'
import {
  PROGRAM_END,
  PROGRAM_LABEL,
  PROGRAM_START,
  READING_PLAN,
  calculateReadingScore,
  canSubmitReading,
  formatDateLabel,
  getProgramPhase,
  getReadingStatus,
  toDateKey,
} from './lib/program'
import {
  QT_ATTENDANCE_POINT,
  buildClassStats,
  buildRankMap,
  buildUserStats,
  canManageQt,
  normalizeCollection,
  normalizeMap,
  sortClassesByScore,
  sortUsersByScore,
  sortUsersForProfile,
} from './lib/scoring'
import { ROLE_LABELS, seedClasses, seedUsers } from './lib/seed'
import { useAuthUser } from './hooks/useAuthUser'

const NAV_ITEMS = [
  { to: '/', label: '내 현황' },
  { to: '/classes', label: '분반' },
  { to: '/users', label: '개인' },
]

const STATUS_TONE_CLASSES = {
  info: 'bg-info',
  success: 'bg-success',
  warning: 'bg-warning',
  error: 'bg-error',
}

const STAT_CARD_THEMES = [
  {
    shell: 'from-pink-200/75 via-white to-rose-100/80',
    value: 'text-pink-600',
  },
  {
    shell: 'from-sky-200/75 via-white to-cyan-100/80',
    value: 'text-sky-600',
  },
  {
    shell: 'from-yellow-200/80 via-white to-orange-100/85',
    value: 'text-orange-500',
  },
]

const TOP_CARD_THEMES = [
  'from-pink-300/60 via-white to-yellow-200/70',
  'from-sky-300/60 via-white to-cyan-200/70',
  'from-violet-300/60 via-white to-fuchsia-200/70',
  'from-emerald-300/60 via-white to-lime-200/70',
  'from-orange-300/60 via-white to-amber-200/70',
]

const RANK_BADGE_THEMES = [
  'from-yellow-300 to-orange-300 text-orange-900',
  'from-sky-300 to-cyan-300 text-sky-900',
  'from-violet-300 to-fuchsia-300 text-violet-900',
]

function indexBy(items, keyField) {
  return items.reduce((map, item) => {
    map[item[keyField]] = item
    return map
  }, {})
}

async function fetchRemoteState() {
  const snapshot = await get(ref(db))
  const payload = snapshot.val() ?? {}

  return {
    hasSeedData: Boolean(payload.users && payload.classes),
    users: normalizeCollection(payload.users, seedUsers),
    classes: normalizeCollection(payload.classes, seedClasses),
    readingRecords: normalizeMap(payload.readingRecords),
    qtRecords: normalizeMap(payload.qtRecords),
  }
}

async function initializeRemoteState() {
  await set(ref(db), {
    meta: {
      seededAt: new Date().toISOString(),
      programStart: PROGRAM_START,
      programEnd: PROGRAM_END,
    },
    users: indexBy(seedUsers, 'userId'),
    classes: indexBy(seedClasses, 'classId'),
    readingRecords: {},
    qtRecords: {},
  })
}

function getDraftKey(userId, dateKey) {
  return `${userId}-${dateKey}`
}

function formatScore(score) {
  return Number(score || 0).toFixed(1)
}

function getStatCardTheme(index) {
  return STAT_CARD_THEMES[index % STAT_CARD_THEMES.length]
}

function getTopCardTheme(index) {
  return TOP_CARD_THEMES[index % TOP_CARD_THEMES.length]
}

function getRankBadgeTheme(index) {
  return RANK_BADGE_THEMES[index % RANK_BADGE_THEMES.length]
}

function App() {
  const [users, setUsers] = useState(seedUsers)
  const [classes, setClasses] = useState(seedClasses)
  const [readingRecords, setReadingRecords] = useState({})
  const [qtRecords, setQtRecords] = useState({})
  const [qtDate, setQtDate] = useState(() => {
    const today = toDateKey()

    if (today < PROGRAM_START) {
      return PROGRAM_START
    }

    if (today > PROGRAM_END) {
      return PROGRAM_END
    }

    return today
  })
  const [readingDrafts, setReadingDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyAction, setBusyAction] = useState('')
  const [banner, setBanner] = useState({
    tone: 'info',
    message: 'Firebase에서 데이터를 불러오는 중입니다.',
  })

  useEffect(() => {
    let disposed = false

    async function loadData() {
      try {
        const remote = await fetchRemoteState()

        if (disposed) {
          return
        }

        setUsers(remote.users)
        setClasses(remote.classes)
        setReadingRecords(remote.readingRecords)
        setQtRecords(remote.qtRecords)
        setBanner({
          tone: remote.hasSeedData ? 'success' : 'warning',
          message: remote.hasSeedData
            ? 'Firebase와 연결되었습니다. 읽기 기록과 QT 출석을 바로 저장할 수 있어요.'
            : 'Firebase에 초기 데이터가 아직 없습니다. 상단 init 버튼으로 명단을 먼저 올릴 수 있어요.',
        })
      } catch (error) {
        if (!disposed) {
          setBanner({
            tone: 'warning',
            message:
              'Firebase 연결에 실패해서 기본 명단으로 미리보기 중입니다. 설정을 확인한 뒤 다시 시도해 주세요.',
          })
        }
      } finally {
        if (!disposed) {
          setLoading(false)
        }
      }
    }

    loadData()

    return () => {
      disposed = true
    }
  }, [])

  const orderedUsers = sortUsersForProfile(users)
  const {
    authError,
    authName,
    authUser: activeUser,
    hydratingAuth,
    isAuthenticated,
    loginByName,
    logout,
  } = useAuthUser(orderedUsers)

  const todayKeyValue = toDateKey()
  const userStatsMap = buildUserStats(users, readingRecords, qtRecords)
  const userLeaderboard = sortUsersByScore(Object.values(userStatsMap))
  const classLeaderboard = sortClassesByScore(
    buildClassStats(classes, users, userStatsMap),
  )
  const userRanks = buildRankMap(userLeaderboard, 'userId')
  const classRanks = buildRankMap(classLeaderboard, 'classId')
  const currentStats = activeUser ? userStatsMap[activeUser.userId] : null
  const currentClass =
    activeUser?.classId != null
      ? classLeaderboard.find((item) => item.classId === activeUser.classId) ?? null
      : null
  const currentRecords = activeUser ? readingRecords[activeUser.userId] ?? {} : {}
  const manageableStudents = sortUsersForProfile(
    users.filter((user) => canManageQt(activeUser, user)),
  )

  useEffect(() => {
    if (!authError) {
      return
    }

    setBanner({
      tone: 'warning',
      message: authError,
    })
  }, [authError])

  async function handleRefresh() {
    setBusyAction('refresh')
    try {
      const remote = await fetchRemoteState()
      setUsers(remote.users)
      setClasses(remote.classes)
      setReadingRecords(remote.readingRecords)
      setQtRecords(remote.qtRecords)
      setBanner({ tone: 'success', message: 'Firebase 데이터를 다시 불러왔습니다.' })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: '다시 불러오기에 실패했습니다. 잠시 뒤 다시 시도해 주세요.',
      })
    } finally {
      setBusyAction('')
    }
  }

  async function handleInitialize() {
    setBusyAction('init')
    try {
      await initializeRemoteState()
      const remote = await fetchRemoteState()
      setUsers(remote.users)
      setClasses(remote.classes)
      setReadingRecords(remote.readingRecords)
      setQtRecords(remote.qtRecords)
      setBanner({
        tone: 'success',
        message: '초기 명단과 분반 데이터가 Firebase에 저장되었습니다.',
      })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: '초기 데이터를 저장하지 못했습니다. Firebase 권한을 확인해 주세요.',
      })
    } finally {
      setBusyAction('')
    }
  }

  function handleDraftChange(userId, dateKey, field, value) {
    const draftKey = getDraftKey(userId, dateKey)
    setReadingDrafts((current) => ({
      ...current,
      [draftKey]: {
        ...current[draftKey],
        [field]: value,
      },
    }))
  }

  function handleLogin(nameInput) {
    const result = loginByName(nameInput)

    if (!result.ok) {
      return
    }

    setBanner({
      tone: 'success',
      message: `${result.user.name}님으로 인증되었습니다.`,
    })
  }

  function handleLogout() {
    logout()
    setBanner({
      tone: 'info',
      message: '이름 쿠키를 삭제했고 다시 인증을 기다리고 있습니다.',
    })
  }

  async function handleReadingSubmit(event, planItem) {
    event.preventDefault()

    if (!activeUser) {
      return
    }

    const draftKey = getDraftKey(activeUser.userId, planItem.date)
    const draft = readingDrafts[draftKey] ?? {}
    const verse = (draft.verse ?? currentRecords[planItem.date]?.verse ?? '').trim()
    const reflection = (
      draft.reflection ??
      currentRecords[planItem.date]?.reflection ??
      ''
    ).trim()

    if (!verse || !reflection) {
      setBanner({
        tone: 'warning',
        message: '성경 구절과 묵상 내용을 모두 적어야 읽기 체크를 저장할 수 있어요.',
      })
      return
    }

    if (!canSubmitReading(planItem.date, todayKeyValue)) {
      setBanner({
        tone: 'warning',
        message: '미래 날짜는 아직 체크할 수 없습니다.',
      })
      return
    }

    setBusyAction(`reading-${planItem.date}`)

    try {
      const previousRecord = currentRecords[planItem.date]
      const now = new Date().toISOString()
      const nextRecord = {
        userId: activeUser.userId,
        userName: activeUser.name,
        classId: activeUser.classId ?? null,
        className: activeUser.className ?? null,
        date: planItem.date,
        passage: planItem.chapter,
        verse,
        reflection,
        score:
          previousRecord?.score ??
          calculateReadingScore({
            planDate: planItem.date,
            submittedAt: now,
          }),
        submittedAt: previousRecord?.submittedAt ?? now,
        updatedAt: now,
      }

      await set(ref(db, `readingRecords/${activeUser.userId}/${planItem.date}`), nextRecord)
      setReadingRecords((current) => ({
        ...current,
        [activeUser.userId]: {
          ...(current[activeUser.userId] ?? {}),
          [planItem.date]: nextRecord,
        },
      }))
      setBanner({
        tone: 'success',
        message: `${activeUser.name}님의 ${planItem.chapter} 읽기 기록을 저장했습니다.`,
      })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: '읽기 기록 저장에 실패했습니다. 네트워크 상태를 확인해 주세요.',
      })
    } finally {
      setBusyAction('')
    }
  }

  async function handleToggleQt(targetUser) {
    if (!activeUser || !canManageQt(activeUser, targetUser)) {
      return
    }

    setBusyAction(`qt-${targetUser.userId}`)

    const alreadyChecked = Boolean(qtRecords[qtDate]?.[targetUser.userId])

    try {
      if (alreadyChecked) {
        await remove(ref(db, `qtRecords/${qtDate}/${targetUser.userId}`))
      } else {
        await set(ref(db, `qtRecords/${qtDate}/${targetUser.userId}`), {
          attended: true,
          checkedBy: activeUser.userId,
          checkedByName: activeUser.name,
          checkedAt: new Date().toISOString(),
        })
      }

      setQtRecords((current) => {
        const currentDateRecords = { ...(current[qtDate] ?? {}) }
        if (alreadyChecked) {
          delete currentDateRecords[targetUser.userId]
        } else {
          currentDateRecords[targetUser.userId] = {
            attended: true,
            checkedBy: activeUser.userId,
            checkedByName: activeUser.name,
            checkedAt: new Date().toISOString(),
          }
        }

        return { ...current, [qtDate]: currentDateRecords }
      })
      setBanner({
        tone: 'success',
        message: alreadyChecked
          ? `${targetUser.name} 학생의 QT 출석 체크를 해제했습니다.`
          : `${targetUser.name} 학생의 QT 출석을 기록했습니다.`,
      })
    } catch (error) {
      setBanner({
        tone: 'error',
        message: 'QT 출석 저장에 실패했습니다. Firebase 권한을 확인해 주세요.',
      })
    } finally {
      setBusyAction('')
    }
  }

  return (
    <div data-theme="church" className="min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-md flex-col px-4 pb-28 pt-4 sm:max-w-6xl sm:px-6 sm:pb-12">
        <header className="glass-card mb-4 overflow-hidden p-4 sm:p-5">
          <div className="drift-slow absolute -right-14 -top-20 h-32 w-32 rounded-full bg-accent/25 blur-3xl" />
          <div className="drift-delay absolute -bottom-20 left-0 h-24 w-24 rounded-full bg-secondary/25 blur-3xl" />
          <div className="relative">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="subtle-label">Bible Reading Check</p>
                <h1 className="font-display text-[1.35rem] leading-tight text-base-content sm:text-[1.7rem]">
                  구리교회 중고등부
                </h1>
                <p className="mt-1 truncate text-xs text-base-content/60 sm:text-sm">
                  {PROGRAM_LABEL} · 빌립보서 3장부터 하루 1장씩
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <span className="fun-pill">하루 한 장</span>
                  <span className="fun-pill">읽기 체크</span>
                  <span className="fun-pill">QT 출석</span>
                </div>
              </div>
              <div className="shrink-0 rounded-[22px] border border-white/85 bg-white/80 px-3 py-2 text-right shadow-sticker">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-base-content/45">
                  사용자
                </p>
                <p className="mt-1 text-sm font-semibold text-base-content sm:text-base">
                  {isAuthenticated && activeUser ? activeUser.name : '미인증'}
                </p>
                <p className="mt-0.5 text-xs text-base-content/55">
                  {isAuthenticated && activeUser
                    ? `${activeUser.className ?? '공동 리더'} · ${ROLE_LABELS[activeUser.role]}`
                    : '이름 입력 필요'}
                </p>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-[20px] border border-white/80 bg-white/72 px-3 py-2 text-xs text-base-content/65 shadow-sm">
              <span
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                  STATUS_TONE_CLASSES[banner.tone] ?? STATUS_TONE_CLASSES.info
                }`}
              />
              <p className="truncate">{banner.message}</p>
            </div>

            <details className="collapse collapse-arrow mt-3 rounded-[24px] border border-white/80 bg-white/72 shadow-sm">
              <summary className="collapse-title min-h-0 px-4 py-3 text-sm font-semibold text-base-content">
                관리 도구 열기
              </summary>
              <div className="collapse-content px-4 pb-4 pt-1">
                <div className="grid gap-2 sm:grid-cols-3">
                  <button
                    type="button"
                    className="btn gradient-button rounded-2xl"
                    onClick={handleInitialize}
                    disabled={busyAction === 'init'}
                  >
                    {busyAction === 'init' ? '저장 중...' : 'Init 데이터'}
                  </button>

                  <button
                    type="button"
                    className="btn rounded-2xl border border-white/85 bg-white/85 text-base-content shadow-sm hover:bg-sky-50"
                    onClick={handleRefresh}
                    disabled={busyAction === 'refresh'}
                  >
                    {busyAction === 'refresh' ? '동기화 중...' : '새로고침'}
                  </button>

                  <button
                    type="button"
                    className="btn rounded-2xl border border-violet-200 bg-violet-50/80 text-violet-700 shadow-sm hover:bg-violet-100"
                    onClick={handleLogout}
                    disabled={!isAuthenticated}
                  >
                    다시 인증
                  </button>
                </div>
              </div>
            </details>
          </div>
        </header>

        {loading || hydratingAuth ? (
          <main className="space-y-4">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="section-card h-32 animate-pulse bg-white/70"
              />
            ))}
          </main>
        ) : !isAuthenticated ? (
          <main className="flex-1">
            <AuthGate
              authError={authError}
              defaultName={authName}
              users={orderedUsers}
              onLogin={handleLogin}
            />
          </main>
        ) : (
          <main className="flex-1">
            <Routes>
              <Route
                path="/"
                element={
                  <DashboardPage
                    activeUser={activeUser}
                    busyAction={busyAction}
                    classRank={activeUser?.classId ? classRanks[activeUser.classId] : null}
                    currentClass={currentClass}
                    currentRecords={currentRecords}
                    currentStats={currentStats}
                    readingDrafts={readingDrafts}
                    todayKeyValue={todayKeyValue}
                    userRank={activeUser ? userRanks[activeUser.userId] : null}
                    onDraftChange={handleDraftChange}
                    onReadingSubmit={handleReadingSubmit}
                  />
                }
              />
              <Route
                path="/classes"
                element={<ClassesPage classLeaderboard={classLeaderboard} />}
              />
              <Route
                path="/users"
                element={
                  <UsersPage
                    activeUser={activeUser}
                    busyAction={busyAction}
                    manageableStudents={manageableStudents}
                    qtDate={qtDate}
                    qtRecords={qtRecords[qtDate] ?? {}}
                    userLeaderboard={userLeaderboard}
                    onQtDateChange={setQtDate}
                    onToggleQt={handleToggleQt}
                  />
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
        )}

        {isAuthenticated ? (
          <nav className="nav-shell fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 p-2 sm:static sm:mt-6 sm:w-full sm:max-w-none sm:translate-x-0">
            <div className="grid grid-cols-3 gap-2">
              {NAV_ITEMS.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    [
                      'rounded-[22px] px-4 py-3 text-center text-sm font-semibold transition',
                      isActive
                        ? 'bg-gradient-to-r from-primary via-fuchsia-400 to-orange-300 text-white shadow-sticker'
                        : 'text-base-content/65 hover:bg-sky-50/90',
                    ].join(' ')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </nav>
        ) : null}
      </div>
    </div>
  )
}

function AuthGate({ authError, defaultName, users, onLogin }) {
  const [nameInput, setNameInput] = useState(defaultName ?? '')

  useEffect(() => {
    setNameInput(defaultName ?? '')
  }, [defaultName])

  function handleSubmit(event) {
    event.preventDefault()
    onLogin(nameInput)
  }

  return (
    <section className="story-card p-5 sm:p-8">
      <div className="max-w-xl">
        <p className="subtle-label">Name Authentication</p>
        <h2 className="section-title mt-1">이름을 입력해 입장해 주세요</h2>
        <p className="mt-3 text-sm leading-6 text-base-content/70">
          접속 시 입력한 이름은 쿠키에 저장되고, 이후에는 해당 이름으로 사용자 정보를 찾아
          화면에서 계속 사용합니다.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="fun-pill">쿠키 자동 로그인</span>
          <span className="fun-pill">내 점수 바로 확인</span>
          <span className="fun-pill">교사 권한 자동 적용</span>
        </div>
      </div>

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="form-control">
          <span className="mb-2 text-sm font-semibold text-base-content/70">이름</span>
          <input
            list="church-user-names"
            type="text"
            className="input fun-input h-14 rounded-[24px] text-base"
            placeholder="명단에 있는 이름을 정확히 입력해 주세요"
            value={nameInput}
            onChange={(event) => setNameInput(event.target.value)}
          />
          <datalist id="church-user-names">
            {users.map((user) => (
              <option key={user.userId} value={user.name}>
                {user.className ?? ROLE_LABELS[user.role]}
              </option>
            ))}
          </datalist>
        </label>

        <div className="rounded-[24px] border border-white/80 bg-white/75 p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/50">
            안내
          </p>
          <p className="mt-2 text-sm leading-6 text-base-content/70">
            총 {users.length}명의 이름이 준비되어 있습니다. 학생과 교사는 같은 입력창을
            사용하며, 인증 뒤에는 역할에 맞는 화면 권한이 적용됩니다.
          </p>
          <p className="mt-2 text-sm leading-6 text-error">
            {authError || '예: 김이룬, 김민재, 박종현'}
          </p>
        </div>

        <button type="submit" className="btn gradient-button h-14 w-full rounded-[24px] text-base">
          이름으로 인증하기
        </button>
      </form>
    </section>
  )
}

function DashboardPage({
  activeUser,
  busyAction,
  classRank,
  currentClass,
  currentRecords,
  currentStats,
  readingDrafts,
  todayKeyValue,
  userRank,
  onDraftChange,
  onReadingSubmit,
}) {
  if (!activeUser || !currentStats) {
    return <EmptyState title="사용자를 찾지 못했습니다." />
  }

  const programPhase = getProgramPhase(todayKeyValue)
  const availableCount = READING_PLAN.filter((item) => item.date <= todayKeyValue).length
  const completionRate = availableCount
    ? Math.round((currentStats.completionCount / availableCount) * 100)
    : 0
  const nextPendingItem =
    READING_PLAN.find((item) => item.date <= todayKeyValue && !currentRecords[item.date]) ??
    READING_PLAN.find((item) => item.date > todayKeyValue) ??
    READING_PLAN[READING_PLAN.length - 1]

  const phaseCopy =
    programPhase === 'before'
      ? '4월 1일 일정 시작을 준비 중입니다.'
      : programPhase === 'after'
        ? '61일 읽기 일정이 마무리되었습니다.'
        : nextPendingItem?.date === todayKeyValue
          ? '오늘 분량을 체크하고 +2점, 오전 9시 전이면 +1점을 더 받을 수 있어요.'
          : '놓친 날짜도 늦게 체크할 수 있으며 이 경우 +1점이 반영됩니다.'

  const monthGroups = [4, 5].map((month) => ({
    month,
    items: READING_PLAN.filter((item) => item.month === month),
  }))

  return (
    <div className="space-y-4">
      <section className="story-card overflow-hidden p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="subtle-label">My Bible Journey</p>
            <h2 className="section-title mt-1 text-[1.95rem]">{activeUser.name}</h2>
            <p className="mt-2 text-sm text-base-content/65">
              {activeUser.className ?? '공동 리더'} · {ROLE_LABELS[activeUser.role]}
            </p>
          </div>
          <span className="spark-badge">
            {programPhase === 'before'
              ? '준비 중'
              : programPhase === 'after'
                ? '일정 종료'
                : '진행 중'}
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-base-content/70">{phaseCopy}</p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <StatCard label="누적 점수" value={`${currentStats.score}점`} index={0} />
          <StatCard label="개인 순위" value={userRank ? `${userRank}위` : '-'} index={1} />
          <StatCard label="진행률" value={`${completionRate}%`} index={2} />
        </div>

        <div className="soft-divider mt-5 pt-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="subtle-label">다음 체크</p>
              <p className="mt-1 text-lg font-semibold text-base-content">
                {nextPendingItem?.chapter ?? '일정을 모두 완료했습니다'}
              </p>
              {nextPendingItem ? (
                <p className="mt-1 text-sm text-base-content/60">
                  {formatDateLabel(nextPendingItem.date)}
                </p>
              ) : null}
            </div>
            <div className="rounded-[24px] border border-white/80 bg-white/75 px-4 py-3 text-right shadow-sticker">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/65">
                완료 기록
              </p>
              <p className="mt-1 text-xl font-semibold text-primary">
                {currentStats.completionCount}회
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="subtle-label">Class Snapshot</p>
            <h3 className="section-title mt-1">분반 현황</h3>
          </div>
          {currentClass ? (
            <span className="badge badge-outline badge-primary px-4 py-3">
              반 순위 {classRank}위
            </span>
          ) : null}
        </div>

        {currentClass ? (
          <>
            <div className="mt-4 grid grid-cols-3 gap-3">
              <StatCard label="분반" value={currentClass.className} index={0} />
              <StatCard
                label="평균 점수"
                value={`${formatScore(currentClass.averageScore)}점`}
                index={1}
              />
              <StatCard label="누적 점수" value={`${currentClass.totalScore}점`} index={2} />
            </div>

            <div className="mt-5 space-y-3">
              {currentClass.members.map((member) => (
                <article
                  key={member.userId}
                  className="list-row flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-base-content">{member.name}</p>
                    <p className="mt-1 text-xs text-base-content/55">
                      {ROLE_LABELS[member.role]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-semibold text-base-content">
                      {member.score}점
                    </p>
                    <p className="text-xs text-base-content/55">
                      {member.completionCount}회 완료
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <EmptyState title="이 계정은 특정 분반에 속해 있지 않습니다." />
        )}
      </section>

      <section className="space-y-4">
        <div className="section-card">
          <p className="subtle-label">Reading Tracker</p>
          <h3 className="section-title mt-1">성경 읽기 현황</h3>
          <p className="mt-3 text-sm leading-6 text-base-content/70">
            당일 23:59 이전 체크는 +2점, 오전 9시 이전에는 추가 +1점이 반영됩니다.
            지나간 날짜를 늦게 체크하면 +1점입니다.
          </p>
        </div>

        {monthGroups.map((group) => (
          <section key={group.month} className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h4 className="font-display text-xl text-base-content">{group.month}월 일정</h4>
              <span className="fun-pill">
                {group.items.length}일
              </span>
            </div>

            {group.items.map((planItem) => {
              const record = currentRecords[planItem.date]
              const draft =
                readingDrafts[getDraftKey(activeUser.userId, planItem.date)] ?? {}

              return (
                <ReadingPlanCard
                  key={planItem.date}
                  busy={busyAction === `reading-${planItem.date}`}
                  draft={draft}
                  planItem={planItem}
                  record={record}
                  todayKeyValue={todayKeyValue}
                  userId={activeUser.userId}
                  onDraftChange={onDraftChange}
                  onSubmit={onReadingSubmit}
                />
              )
            })}
          </section>
        ))}
      </section>
    </div>
  )
}

function ClassesPage({ classLeaderboard }) {
  const topAverage = classLeaderboard[0]?.averageScore ?? 1

  return (
    <div className="space-y-4">
      <section className="story-card p-5">
        <p className="subtle-label">Class Ranking</p>
        <h2 className="section-title mt-1">분반 정보</h2>
        <p className="mt-3 text-sm leading-6 text-base-content/70">
          성경 읽기 점수와 QT 참석 점수를 함께 반영한 평균 점수로 정렬했고, 상위 5개 분반을
          먼저 강조해 보여줍니다.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {classLeaderboard.slice(0, 5).map((classInfo, index) => (
          <article
            key={classInfo.classId}
            className={`section-card bg-gradient-to-br ${getTopCardTheme(index)}`}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
              Top {index + 1}
            </p>
            <h3 className="mt-2 font-display text-2xl text-base-content">
              {classInfo.className}
            </h3>
            <p className="mt-4 text-3xl font-semibold text-primary">
              {formatScore(classInfo.averageScore)}
              <span className="ml-1 text-base font-medium text-base-content/50">점</span>
            </p>
            <p className="mt-1 text-sm text-base-content/60">
              총 {classInfo.totalScore}점 · {classInfo.totalCount}명
            </p>
            <p className="mt-4 text-sm text-base-content/70">
              최고 점수: {classInfo.topMember?.name ?? '기록 없음'} ·{' '}
              {classInfo.topMember?.score ?? 0}점
            </p>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        {classLeaderboard.map((classInfo, index) => (
          <article key={classInfo.classId} className="section-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="spark-badge inline-flex">#{index + 1}</p>
                <h3 className="mt-1 font-display text-2xl text-base-content">
                  {classInfo.className}
                </h3>
                <p className="mt-2 text-sm text-base-content/60">
                  교사 {classInfo.teacherCount}명 · 학생 {classInfo.studentCount}명
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold text-primary">
                  {formatScore(classInfo.averageScore)}점
                </p>
                <p className="text-sm text-base-content/55">
                  누적 {classInfo.totalScore}점
                </p>
              </div>
            </div>

            <progress
              className="progress progress-primary mt-4 h-4 w-full rounded-full"
              value={classInfo.averageScore}
              max={topAverage || 1}
            />

            <div className="mt-4 flex items-center justify-between gap-3 text-sm text-base-content/65">
              <span>담당 교사: {classInfo.teacher?.name ?? '미지정'}</span>
              <span>상위 멤버: {classInfo.topMember?.name ?? '기록 없음'}</span>
            </div>
          </article>
        ))}
      </section>
    </div>
  )
}

function UsersPage({
  activeUser,
  busyAction,
  manageableStudents,
  qtDate,
  qtRecords,
  userLeaderboard,
  onQtDateChange,
  onToggleQt,
}) {
  return (
    <div className="space-y-4">
      <section className="story-card p-5">
        <p className="subtle-label">Personal Ranking</p>
        <h2 className="section-title mt-1">개인 정보</h2>
        <p className="mt-3 text-sm leading-6 text-base-content/70">
          성경 읽기 점수와 QT 참석 점수를 합산해 상위 10명을 먼저 보여주고, 교사 권한 계정은
          QT 참석 체크 도구를 사용할 수 있습니다.
        </p>
      </section>

      <section className="space-y-3">
        {userLeaderboard.slice(0, 10).map((user, index) => (
          <article
            key={user.userId}
            className={`section-card flex items-center justify-between gap-4 ${
              index < 3 ? `bg-gradient-to-r ${getTopCardTheme(index)}` : ''
            }`}
          >
            <div className="flex items-center gap-4">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-[18px] bg-gradient-to-br ${getRankBadgeTheme(
                  index,
                )} text-lg font-semibold shadow-sticker`}
              >
                {index + 1}
              </div>
              <div>
                <p className="font-semibold text-base-content">{user.name}</p>
                <p className="mt-1 text-sm text-base-content/60">
                  {user.className ?? '공동 리더'} · {ROLE_LABELS[user.role]}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xl font-semibold text-primary">{user.score}점</p>
              <p className="text-xs text-base-content/55">
                읽기 {user.readingScore}점 · QT {user.qtScore}점
              </p>
            </div>
          </article>
        ))}
      </section>

      <section className="section-card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="subtle-label">Morning QT</p>
            <h3 className="section-title mt-1">QT 참석 체크</h3>
            <p className="mt-2 text-sm text-base-content/60">
              QT 참석 1회당 {QT_ATTENDANCE_POINT}점이 개인 점수와 분반 점수에 반영됩니다.
            </p>
          </div>
          <label className="form-control">
            <span className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-base-content/55">
              날짜
            </span>
            <input
              type="date"
              className="input fun-input rounded-2xl"
              min={PROGRAM_START}
              max={PROGRAM_END}
              value={qtDate}
              onChange={(event) => onQtDateChange(event.target.value)}
            />
          </label>
        </div>

        {manageableStudents.length > 0 ? (
          <div className="mt-5 space-y-3">
            {manageableStudents.map((student) => {
              const attendance = qtRecords[student.userId]
              const checked = Boolean(attendance)

              return (
                <article
                  key={student.userId}
                  className="list-row flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div>
                    <p className="font-semibold text-base-content">{student.name}</p>
                    <p className="mt-1 text-sm text-base-content/55">{student.className}</p>
                    {checked ? (
                      <p className="mt-1 text-xs text-secondary">
                        체크자: {attendance.checkedByName}
                      </p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={`btn rounded-2xl ${
                      checked
                        ? 'border-none bg-gradient-to-r from-emerald-400 to-teal-300 text-teal-950 shadow-sticker'
                        : 'border border-primary/20 bg-white/90 text-primary shadow-sm hover:bg-pink-50'
                    }`}
                    onClick={() => onToggleQt(student)}
                    disabled={busyAction === `qt-${student.userId}`}
                  >
                    {busyAction === `qt-${student.userId}`
                      ? '저장 중...'
                      : checked
                        ? '참석 해제'
                        : '참석 체크'}
                  </button>
                </article>
              )
            })}
          </div>
        ) : (
          <EmptyState
            title={`${activeUser?.name ?? '현재 계정'} 계정은 QT 참석 체크 권한이 없습니다.`}
          />
        )}
      </section>
    </div>
  )
}

function ReadingPlanCard({
  busy,
  draft,
  planItem,
  record,
  todayKeyValue,
  userId,
  onDraftChange,
  onSubmit,
}) {
  const status = getReadingStatus({
    dateKey: planItem.date,
    record,
    todayKeyValue,
  })
  const disabled = !canSubmitReading(planItem.date, todayKeyValue)

  return (
    <details
      open={planItem.date === todayKeyValue}
      className="collapse collapse-arrow overflow-hidden rounded-[28px] border border-white/90 bg-gradient-to-br from-white/95 via-white/85 to-sky-50/85 shadow-candy"
    >
      <summary className="collapse-title px-4 py-4">
        <div className="flex items-start gap-4">
          <div className="rounded-[22px] bg-gradient-to-br from-primary/20 via-fuchsia-100 to-orange-100 px-3 py-2 text-center shadow-sticker">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">
              Day
            </p>
            <p className="mt-1 text-xl font-semibold text-primary">
              {Number(planItem.date.slice(-2))}
            </p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-lg font-semibold text-base-content">
              {planItem.chapter}
            </p>
            <p className="mt-1 text-sm text-base-content/60">
              {formatDateLabel(planItem.date)}
            </p>
          </div>
          <div className="text-right">
            <span className={`badge ${status.badgeClass} rounded-full px-3 py-3 shadow-sm`}>
              {status.label}
            </span>
            {record ? (
              <p className="mt-2 text-xs font-semibold text-base-content/55">
                +{record.score}점
              </p>
            ) : null}
          </div>
        </div>
      </summary>

      <div className="collapse-content space-y-4">
        {record ? (
          <div className="rounded-[24px] border border-white/80 bg-gradient-to-br from-sky-100/70 via-white to-cyan-50/70 p-4 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-secondary/75">
              저장된 기록
            </p>
            <p className="mt-3 text-sm font-semibold text-base-content">성경 구절</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-base-content/75">
              {record.verse}
            </p>
            <p className="mt-4 text-sm font-semibold text-base-content">묵상한 내용</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-base-content/75">
              {record.reflection}
            </p>
            <p className="mt-4 text-xs text-base-content/50">
              저장 시각: {new Date(record.updatedAt ?? record.submittedAt).toLocaleString('ko-KR')}
            </p>
          </div>
        ) : null}

        {disabled ? (
          <div className="rounded-[24px] border border-dashed border-violet-200 bg-violet-50/70 p-4 text-sm leading-6 text-base-content/65">
            아직 해당 날짜가 오지 않아 체크를 열지 않았습니다.
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(event) => onSubmit(event, planItem)}>
            <label className="form-control">
              <span className="mb-2 text-sm font-semibold text-base-content/70">성경 구절</span>
              <input
                type="text"
                className="input fun-input rounded-2xl"
                placeholder="기억에 남은 구절을 적어 주세요"
                value={draft.verse ?? record?.verse ?? ''}
                onChange={(event) =>
                  onDraftChange(userId, planItem.date, 'verse', event.target.value)
                }
              />
            </label>

            <label className="form-control">
              <span className="mb-2 text-sm font-semibold text-base-content/70">
                묵상한 내용
              </span>
              <textarea
                className="textarea fun-input min-h-28 rounded-2xl"
                placeholder="오늘 받은 은혜나 적용점을 적어 주세요"
                value={draft.reflection ?? record?.reflection ?? ''}
                onChange={(event) =>
                  onDraftChange(userId, planItem.date, 'reflection', event.target.value)
                }
              />
            </label>

            <div className="flex items-center justify-between gap-3 rounded-[24px] border border-white/85 bg-gradient-to-r from-yellow-100/80 via-pink-50 to-orange-100/80 px-4 py-3 shadow-sm">
              <p className="text-sm leading-6 text-base-content/70">
                당일 체크 +2점, 오전 9시 전 +1점, 늦은 체크 +1점
              </p>
              <button type="submit" className="btn gradient-button rounded-2xl" disabled={busy}>
                {busy ? '저장 중...' : record ? '기록 업데이트' : '읽기 체크'}
              </button>
            </div>
          </form>
        )}
      </div>
    </details>
  )
}

function StatCard({ label, value, index = 0 }) {
  const theme = getStatCardTheme(index)

  return (
    <article
      className={`rounded-[24px] border border-white/85 bg-gradient-to-br ${theme.shell} px-4 py-4 shadow-sticker`}
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/55">
        {label}
      </p>
      <p className={`mt-2 text-lg font-semibold ${theme.value}`}>{value}</p>
    </article>
  )
}

function EmptyState({ title }) {
  return (
    <div className="rounded-[24px] border border-dashed border-primary/30 bg-white/70 px-4 py-5 text-sm leading-6 text-base-content/65 shadow-sm">
      {title}
    </div>
  )
}

export default App
