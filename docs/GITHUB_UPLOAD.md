# 上传到 GitHub 指南

本文说明如何安全地把 TradeAnchor 项目推送到 GitHub，**不包含 API Key、密码等敏感信息**。

## 上传前检查清单

- [ ] 本地 `.env` 文件**未**被 git 跟踪（已在 `.gitignore` 中排除）
- [ ] 运行安全检查：`powershell -File scripts/check-secrets.ps1`
- [ ] 确认 `deploy.ps1`（含真实服务器 IP）未被提交
- [ ] 若仓库曾公开过真实密钥，请在各服务商**轮换密钥**

## 会被 Git 忽略的文件（不会上传）

| 类型 | 示例 |
|------|------|
| 环境变量 | `.env`、`.env.local`、`.env.production` |
| 依赖与构建 | `node_modules/`、`dist/` |
| 用户数据 | `uploads/`、`packages/backend/uploads/` |
| 数据库卷 | `postgres_data/`、`redis_data/`、`mongodb_data/` |
| 个人部署配置 | `deploy.ps1`、`deploy.local.sh` |
| SSH / 证书 | `*.pem`、`id_rsa`、`credentials.json` |
| 压缩包 | `*.tar.gz`、`*.zip` |

## 会上传的配置模板（占位符，无真实密钥）

| 文件 | 说明 |
|------|------|
| `packages/backend/.env.example` | 后端全部环境变量说明 |
| `packages/frontend/.env.example` | 前端环境变量说明 |
| `.env.example` | Docker Compose 生产环境模板 |
| `k8s/secret.yaml` | K8s Secret 模板（均为 `CHANGE_ME` 占位符） |

## 首次上传步骤

```powershell
# 1. 在项目根目录
cd C:\Users\何金玉\Desktop\TradeAnchor

# 2. 安全检查
powershell -File scripts/check-secrets.ps1

# 3. 查看将要提交的内容
git status
git diff

# 4. 添加所有安全文件（.gitignore 会自动排除敏感文件）
git add .

# 5. 再次确认没有 .env
git status | Select-String "\.env"

# 6. 提交
git commit -m "Initial public release"

# 7. 在 GitHub 创建空仓库后，关联并推送
git remote add origin https://github.com/YOUR_USERNAME/TradeAnchor.git
git branch -M main
git push -u origin main
```

## 克隆后如何配置

```bash
cp packages/backend/.env.example packages/backend/.env
cp packages/frontend/.env.example packages/frontend/.env
# 编辑 .env 填入自己的 API Key 和数据库连接
pnpm install
pnpm dev
```

## 开发种子账号

`pnpm db:seed` 会创建三个 **example.com** 测试账号，密码由环境变量 `SEED_PASSWORD` 控制（默认 `ChangeMeInDev123!`）。  
**不要在生产环境使用默认密码。**
