import { useEffect, useState } from 'react'

const AUTH_COOKIE_KEY = 'church_user_name'
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30

function readCookie(name) {
  if (typeof document === 'undefined') {
    return ''
  }

  const cookie = document.cookie
    .split('; ')
    .find((item) => item.startsWith(`${name}=`))

  if (!cookie) {
    return ''
  }

  return decodeURIComponent(cookie.split('=').slice(1).join('='))
}

function writeCookie(name, value, maxAge) {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = [
    `${name}=${encodeURIComponent(value)}`,
    'path=/',
    `max-age=${maxAge}`,
    'samesite=lax',
  ].join('; ')
}

function deleteCookie(name) {
  if (typeof document === 'undefined') {
    return
  }

  document.cookie = [`${name}=`, 'path=/', 'max-age=0', 'samesite=lax'].join('; ')
}

function findUserByName(users, name) {
  const normalizedName = name.trim()

  if (!normalizedName) {
    return null
  }

  return users.find((user) => user.name === normalizedName) ?? null
}

export function useAuthUser(users) {
  const [authName, setAuthName] = useState('')
  const [authUser, setAuthUser] = useState(null)
  const [authError, setAuthError] = useState('')
  const [hydratingAuth, setHydratingAuth] = useState(true)

  useEffect(() => {
    const savedName = readCookie(AUTH_COOKIE_KEY).trim()

    setAuthName(savedName)
    setHydratingAuth(false)
  }, [])

  useEffect(() => {
    if (hydratingAuth) {
      return
    }

    if (!authName) {
      setAuthUser(null)
      return
    }

    const matchedUser = findUserByName(users, authName)

    if (matchedUser) {
      setAuthUser(matchedUser)
      setAuthError('')
      return
    }

    deleteCookie(AUTH_COOKIE_KEY)
    setAuthName('')
    setAuthUser(null)
    setAuthError('저장된 이름을 명단에서 찾지 못해 다시 인증이 필요합니다.')
  }, [authName, hydratingAuth, users])

  function loginByName(nameInput) {
    const trimmedName = nameInput.trim()

    if (!trimmedName) {
      setAuthError('이름을 입력해 주세요.')
      return { ok: false }
    }

    const matchedUser = findUserByName(users, trimmedName)

    if (!matchedUser) {
      setAuthError('입력한 이름이 명단에 없습니다. 정확한 이름을 입력해 주세요.')
      return { ok: false }
    }

    writeCookie(AUTH_COOKIE_KEY, trimmedName, AUTH_COOKIE_MAX_AGE)
    setAuthName(trimmedName)
    setAuthUser(matchedUser)
    setAuthError('')

    return { ok: true, user: matchedUser }
  }

  function logout() {
    deleteCookie(AUTH_COOKIE_KEY)
    setAuthName('')
    setAuthUser(null)
    setAuthError('')
  }

  return {
    authError,
    authName,
    authUser,
    hydratingAuth,
    isAuthenticated: Boolean(authUser),
    loginByName,
    logout,
  }
}
