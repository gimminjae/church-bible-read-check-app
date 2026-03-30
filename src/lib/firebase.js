import { initializeApp } from 'firebase/app'
import { getDatabase } from 'firebase/database'

function getEnvValue(key, { optional = false } = {}) {
  const value = import.meta.env[key]

  if (value) {
    return value
  }

  if (optional) {
    return undefined
  }

  throw new Error(`${key} 환경변수가 설정되지 않았습니다.`)
}

export const firebaseConfig = {
  apiKey: getEnvValue('VITE_FIREBASE_API_KEY'),
  authDomain: getEnvValue('VITE_FIREBASE_AUTH_DOMAIN'),
  databaseURL: getEnvValue('VITE_FIREBASE_DATABASE_URL'),
  projectId: getEnvValue('VITE_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvValue('VITE_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvValue('VITE_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvValue('VITE_FIREBASE_APP_ID'),
  measurementId: getEnvValue('VITE_FIREBASE_MEASUREMENT_ID', { optional: true }),
}

const app = initializeApp(firebaseConfig)

export const db = getDatabase(app)
