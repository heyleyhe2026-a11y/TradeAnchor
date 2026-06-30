# TradeWise Frontend

TradeWise 前端应用 - 基于 React + TypeScript + Vite 构建的现代化交易日志平台。

## 技术栈

- **框架**: React 18 + TypeScript
- **构建工具**: Vite
- **状态管理**: Redux Toolkit + RTK Query
- **UI 库**: Material-UI (MUI)
- **国际化**: react-i18next
- **路由**: React Router v6
- **样式**: Emotion (MUI 内置)

## 项目结构

```
src/
├── components/       # 可复用组件
│   └── LanguageSwitcher.tsx
├── i18n/            # 国际化配置和翻译文件
│   ├── config.ts
│   ├── en.json
│   └── zh-CN.json
├── layouts/         # 布局组件
│   └── RootLayout.tsx
├── pages/           # 页面组件
│   ├── auth/
│   ├── dashboard/
│   ├── LandingPage.tsx
│   └── NotFoundPage.tsx
├── routes/          # 路由配置
│   └── index.tsx
├── store/           # Redux store 配置
│   ├── api.ts       # RTK Query API 配置
│   ├── hooks.ts     # 类型化的 Redux hooks
│   └── index.ts     # Store 配置
├── theme/           # MUI 主题配置
│   └── index.ts
├── utils/           # 工具函数
│   └── timezone.ts
├── App.tsx          # 根组件
├── main.tsx         # 应用入口
└── index.css        # 全局样式
```

## 功能特性

### ✅ 已配置功能

1. **Redux Toolkit + RTK Query**
   - 集中式状态管理
   - 自动化的 API 请求处理
   - 内置缓存和重新获取机制
   - 类型安全的 hooks

2. **Material-UI (MUI)**
   - 完整的 UI 组件库
   - 自定义主题配置
   - 响应式设计支持
   - 深色/浅色模式支持

3. **国际化 (i18next)**
   - 支持简体中文和英文
   - 自动语言检测
   - 本地存储语言偏好
   - 完整的翻译文件

4. **React Router v6**
   - 声明式路由配置
   - 嵌套路由支持
   - 错误边界处理
   - 代码分割准备

5. **TypeScript**
   - 完整的类型安全
   - 智能代码提示
   - 编译时错误检查

## 开发指南

### 安装依赖

```bash
# 在项目根目录
pnpm install
```

### 启动开发服务器

```bash
# 在 packages/frontend 目录
pnpm dev

# 或在项目根目录
pnpm --filter @tradeanchor/frontend dev
```

开发服务器将在 http://localhost:5173 启动

### 构建生产版本

```bash
pnpm build
```

### 预览生产构建

```bash
pnpm preview
```

### 运行测试

```bash
pnpm test
```

### 代码检查

```bash
pnpm lint
```

### 类型检查

```bash
pnpm type-check
```

## 环境变量

创建 `.env` 文件配置环境变量:

```env
# API 配置
VITE_API_BASE_URL=http://localhost:3000/v1

# 应用配置
VITE_APP_NAME=TradeWise
VITE_APP_VERSION=1.0.0

# 功能开关
VITE_ENABLE_DEBUG=true
```

## Redux Store 配置

### RTK Query API

所有 API 请求通过 RTK Query 管理,配置在 `src/store/api.ts`:

```typescript
import { api } from './store/api';

// 定义 API endpoints
export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation({
      query: (credentials) => ({
        url: '/auth/login',
        method: 'POST',
        body: credentials,
      }),
    }),
  }),
});

export const { useLoginMutation } = authApi;
```

### 使用 Redux Hooks

```typescript
import { useAppDispatch, useAppSelector } from './store/hooks';

function MyComponent() {
  const dispatch = useAppDispatch();
  const data = useAppSelector((state) => state.someSlice);
  // ...
}
```

## 国际化使用

### 在组件中使用翻译

```typescript
import { useTranslation } from 'react-i18next';

function MyComponent() {
  const { t, i18n } = useTranslation();
  
  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <button onClick={() => i18n.changeLanguage('zh-CN')}>
        切换到中文
      </button>
    </div>
  );
}
```

### 添加新的翻译

在 `src/i18n/en.json` 和 `src/i18n/zh-CN.json` 中添加对应的键值对。

## MUI 主题定制

主题配置在 `src/theme/index.ts`:

```typescript
import { createTheme } from '@mui/material/styles';

export const theme = createTheme({
  palette: {
    primary: {
      main: '#1976d2',
    },
    // ... 更多配置
  },
});
```

## 路由配置

路由定义在 `src/routes/index.tsx`:

```typescript
const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'login', element: <LoginPage /> },
      // ... 更多路由
    ],
  },
]);
```

## API 代理配置

开发环境下,Vite 会将 `/api` 请求代理到后端服务器 (配置在 `vite.config.ts`):

```typescript
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

## 性能优化

1. **代码分割**: 使用 React.lazy() 和 Suspense 进行路由级别的代码分割
2. **图片优化**: 使用 WebP 格式和懒加载
3. **缓存策略**: RTK Query 自动处理 API 响应缓存
4. **Tree Shaking**: Vite 自动移除未使用的代码

## 浏览器支持

- Chrome (最新版本)
- Firefox (最新版本)
- Safari (最新版本)
- Edge (最新版本)

## 相关文档

- [React 文档](https://react.dev/)
- [Vite 文档](https://vitejs.dev/)
- [Redux Toolkit 文档](https://redux-toolkit.js.org/)
- [Material-UI 文档](https://mui.com/)
- [React Router 文档](https://reactrouter.com/)
- [i18next 文档](https://www.i18next.com/)

## 许可证

MIT
