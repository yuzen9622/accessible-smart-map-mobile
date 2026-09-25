# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## 本專案設定

- 設計文件：[`docs/SDD.md`](docs/SDD.md)、分期計畫：[`docs/ROADMAP.md`](docs/ROADMAP.md)、移植帳本：[`docs/port-ledger.md`](docs/port-ledger.md)
- 需要 development build（已裝 `expo-dev-client`，不能用 Expo Go）：`LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8 npx expo run:ios`
- 環境變數寫在 `.env`（公開值，會內嵌進 bundle，不放 secret）；本機覆寫用 `.env.local`。缺值或格式錯誤時 App 會顯示設定錯誤畫面。

| 變數 | 必填 | 說明 |
|---|---|---|
| `EXPO_PUBLIC_END_POINT` | 是 | API base URL（dev：`https://map-dev.yuzen.dev`） |
| `EXPO_PUBLIC_SHARE_BASE_URL` | 是 | 分享連結網域（`https://map.yuzen.dev`） |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Phase 3 | Google 登入 web client ID |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` | Phase 3 | Google 登入 iOS client ID |

- 檢查：`npm run typecheck`、`npm run lint`、`npm test`

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

### Other setup steps

- To set up ESLint for linting, run `npx expo lint`, or follow our guide on ["Using ESLint and Prettier"](https://docs.expo.dev/guides/using-eslint/)
- If you'd like to set up unit testing, follow our guide on ["Unit Testing with Jest"](https://docs.expo.dev/develop/unit-testing/)
- Learn more about the TypeScript setup in this template in our guide on ["Using TypeScript"](https://docs.expo.dev/guides/typescript/)

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
