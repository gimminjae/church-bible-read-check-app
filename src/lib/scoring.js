const TEACHER_ROLES = ['TEACHER', 'TEACHER_ADMIN', 'VICE_LEADER']
export const QT_ATTENDANCE_POINT = 1

const ROLE_ORDER = {
  VICE_LEADER: 0,
  TEACHER_ADMIN: 1,
  TEACHER: 2,
  STUDENT: 3,
}

export function normalizeCollection(collection, fallback) {
  if (Array.isArray(collection)) {
    return collection.filter(Boolean)
  }

  if (collection && typeof collection === 'object') {
    return Object.values(collection)
  }

  return fallback
}

export function normalizeMap(collection) {
  if (collection && typeof collection === 'object') {
    return collection
  }

  return {}
}

export function sortUsersForProfile(users) {
  return [...users].sort((left, right) => {
    const leftClass = left.classId ?? -1
    const rightClass = right.classId ?? -1

    if (leftClass !== rightClass) {
      return leftClass - rightClass
    }

    const roleGap = (ROLE_ORDER[left.role] ?? 99) - (ROLE_ORDER[right.role] ?? 99)

    if (roleGap !== 0) {
      return roleGap
    }

    return left.name.localeCompare(right.name, 'ko-KR')
  })
}

export function isTeacherRole(role) {
  return TEACHER_ROLES.includes(role)
}

export function canManageQt(currentUser, targetUser) {
  if (!currentUser || targetUser.role !== 'STUDENT' || !isTeacherRole(currentUser.role)) {
    return false
  }

  if (currentUser.role === 'TEACHER_ADMIN' || currentUser.role === 'VICE_LEADER') {
    return true
  }

  return currentUser.classId === targetUser.classId
}

function countQtAttendance(qtRecords, userId) {
  return Object.values(qtRecords ?? {}).reduce((count, dateRecords) => {
    if (dateRecords?.[userId]?.attended) {
      return count + 1
    }

    return count
  }, 0)
}

export function buildUserStats(users, readingRecords, qtRecords = {}) {
  return users.reduce((statsMap, user) => {
    const records = Object.values(readingRecords?.[user.userId] ?? {})
    const readingScore = records.reduce((sum, record) => sum + (Number(record.score) || 0), 0)
    const qtAttendanceCount = countQtAttendance(qtRecords, user.userId)
    const qtScore = qtAttendanceCount * QT_ATTENDANCE_POINT
    const score = readingScore + qtScore
    const morningCount = records.filter((record) => Number(record.score) === 3).length
    const onTimeCount = records.filter((record) => Number(record.score) >= 2).length
    const lateCount = records.filter((record) => Number(record.score) === 1).length

    statsMap[user.userId] = {
      ...user,
      readingScore,
      qtScore,
      qtAttendanceCount,
      score,
      morningCount,
      onTimeCount,
      lateCount,
      completionCount: records.length,
      records,
    }

    return statsMap
  }, {})
}

export function sortUsersByScore(userStats) {
  return [...userStats].sort((left, right) => {
    if (left.score !== right.score) {
      return right.score - left.score
    }

    if (left.completionCount !== right.completionCount) {
      return right.completionCount - left.completionCount
    }

    if (left.morningCount !== right.morningCount) {
      return right.morningCount - left.morningCount
    }

    return left.name.localeCompare(right.name, 'ko-KR')
  })
}

export function buildClassStats(classes, users, userStatsMap) {
  return classes.map((classInfo) => {
    const members = users
      .filter((user) => user.classId === classInfo.classId)
      .map((user) => userStatsMap[user.userId])
      .filter(Boolean)
      .sort((left, right) => {
        if (left.score !== right.score) {
          return right.score - left.score
        }

        return left.name.localeCompare(right.name, 'ko-KR')
      })

    const totalScore = members.reduce((sum, member) => sum + member.score, 0)
    const averageScore = members.length ? totalScore / members.length : 0
    const teacher = members.find((member) => member.role !== 'STUDENT') ?? null
    const topMember = members[0] ?? null

    return {
      ...classInfo,
      totalScore,
      averageScore,
      teacher,
      topMember,
      members,
    }
  })
}

export function sortClassesByScore(classStats) {
  return [...classStats].sort((left, right) => {
    if (left.averageScore !== right.averageScore) {
      return right.averageScore - left.averageScore
    }

    if (left.totalScore !== right.totalScore) {
      return right.totalScore - left.totalScore
    }

    return left.className.localeCompare(right.className, 'ko-KR')
  })
}

export function buildRankMap(items, keyField) {
  return items.reduce((rankMap, item, index) => {
    rankMap[item[keyField]] = index + 1
    return rankMap
  }, {})
}
