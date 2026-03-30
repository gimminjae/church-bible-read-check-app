# Church App

구리교회 중고등부 성경 읽기 체크 웹입니다.

## Environment Variables

Firebase 설정은 코드에 직접 두지 않고 Vite 환경변수로 읽습니다.

1. `.env.example`을 참고해서 `.env.local` 파일을 만듭니다.
2. 아래 명령으로 실행합니다.

```bash
npm install
npm run dev
```

필수 변수:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`
