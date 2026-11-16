# AutoJuben Cloud v0.3.0 — Vercel + Supabase + TypeScript + GraphQL

从 `AutoJubenLauncher.exe` 已确认的启动器管理能力改造的 Web SaaS，并整合 `151_9tu_api_integration.md` 的视频生成 API。**本项目包含实际前端、GraphQL resolvers、数据库 SQL、Supabase Storage 和定时任务代码**；并非只有静态模板。

> 原 ZIP 只有 Windows 启动器 EXE，没有启动器远程下载的 AutoJuben 剧本业务后端。因此这里复刻的是 EXE 可观察的启动器管理能力，加上新写的视频 SaaS；不宣称已复刻缺失的原业务后端。此前 v0.2.0 Docker 版本不能直接部署到 Vercel，本版已移除常驻服务和 Docker 依赖。

## 架构

```text
Browser — React + Vite + TypeScript (Vercel CDN)
  ├─ POST /graphql — Vercel Functions / TypeScript / GraphQL Yoga
  ├─ POST /auth/* — Supabase Auth（验证密码、邮箱确认）+ PostgreSQL 服务端 Cookie Sessions
  ├─ /api/uploads — Vercel 授权 → Supabase Storage 签名上传 → 浏览器直传
  └─ /api/jobs/{id}/video — 受控链接或提供商代理
                         ↓
Supabase Postgres — projects, users, orgs, memberships, assets, video_jobs, audit, backups
Supabase Storage (private) — uploaded media, backup snapshots
Supabase Cron (pg_cron + pg_net + Vault) → POST Vercel /api/cron
  → PostgreSQL 租约/幂等 → 151 视频 API → 任务状态/视频 URL
```

## 1. 创建 Supabase 项目

1. 在 [Supabase Dashboard](https://supabase.com/dashboard) 建立项目，选择与你 Vercel Function 尽量接近的 Region。
2. 打开 SQL Editor，**按顺序**执行 `sql/001_initial.sql` → `sql/002_launcher_port.sql` → `sql/003_supabase_vercel.sql`。`003` 为所有 SaaS 业务表启用 RLS，**不允许**匿名 Supabase REST 查询；所有业务读写通过服务器端 GraphQL 鉴权。不要把 `SUPABASE_SECRET_KEY` 放入网页环境变量。
3. Storage → 创建**私有** bucket `autojuben-media`，关闭 Public。最大文件大小在 Free 计划全局限制内建议设为 45 MB（本项目 `MAX_UPLOAD_MB=45`）；若计划不同，请同时调整环境配置。
4. Authentication → Providers → Email：启用 Email/Password，建议**要求 Email Confirmation**；URL Configuration 中将 Site URL 配为正式 Vercel 域名，例如 `https://your-project.vercel.app`，根据需要配置允许的 Redirect URLs。**登录凭据由 Supabase Auth 验证；业务会话仍使用服务端 Postgres 的 HttpOnly Cookie**。
5. Database → Connect：选择 **Transaction Pooler**（端口通常为 `6543`）复制 `DATABASE_URL`，注意在 Vercel 的环境变量里作为 *secret* 保存，必要时 URL encode 密码。参照 Supabase 控制台实际提供的连接字符串，不要直接使用示例值。

> 不使用 Supabase Auth 的 REST 密钥作为 Postgres 密码。SQL 在服务器端通过 Supabase Postgres 连接执行，RLS 阻止 anon/authenticated Data API 直接访问这些表。

## 2. 创建 Vercel 项目

1. 将 ZIP 内整个工程上传到 GitHub 仓库（ZIP 包本身不能直接作为 Vercel Git 项目）。
2. Vercel → Add New → Project → Import Git Repository，选择项目**根目录**，不是 `apps/web`。
3. `vercel.json` 已配置 `framework=vite`、`buildCommand=npm run build:web`、`outputDirectory=apps/web/dist`，API Function 位于根目录 `api/handler.ts`、`api/cron.ts`。Node.js 选 22.x 或兼容版本，开启 Fluid Compute。
4. 在 Vercel Settings → Environment Variables 逐项配置 `.env.example` 中的变量：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | Supabase **transaction pooler** 连接串（保密） |
| `SUPABASE_URL` | `https://<project>.supabase.co` |
| `SUPABASE_PUBLISHABLE_KEY` | 公共 publishable/anon key（用于服务端 Auth 登录） |
| `SUPABASE_SECRET_KEY` | **服务器独有**的 secret/service-role key（Storage 签发令牌） |
| `SUPABASE_STORAGE_BUCKET` | `autojuben-media` |
| `VITE_SUPABASE_URL` | 构建时公开给前端的 Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 构建时公开给前端的 publishable key |
| `PUBLIC_ORIGIN` | Vercel 正式 HTTPS Origin（不带尾部 /） |
| `ENCRYPTION_KEY` | 用 `openssl rand -base64 32` 生成，用于 AES-256-GCM 加密视频卡密。**保存并备份，丢失后原卡密无法解密** |
| `CRON_SECRET` | 随机至少 32 字符，用于保护 `/api/cron` |
| `VIDEO_API_BASE_URL` | 151 视频生成 API 地址；当前文档只给出 HTTP 明文地址，生产应优先使用提供商的 HTTPS 地址 |
| `VIDEO_API_LICENSE_KEY` | 可选平台卡密；工作区也能在设置页各自保存加密卡密 |
| `MOCK_VIDEO_PROVIDER` | `true` 仅供演示，不产生真实 MP4；实战设 `false` |
| `MAX_UPLOAD_MB` | 默认 `45`，适合 Supabase Free 全局文件上限 |
| `APP_VERSION` | 建议填 `0.3.0` |
| `PLATFORM_ADMIN_EMAILS` | 可选平台管理员邮箱，控制发布元数据等管理功能 |

5. 部署并访问 `https://<your-project>.vercel.app/healthz`，应返回 `ok:true`。然后注册、邮件确认、登录并创建工作区。发布环境的环境变量修改后要 **Redeploy**。

## 3. 配置不依赖常驻进程的视频任务 Worker（必做）

1. Supabase Database → Extensions 启用 `pg_cron`、`pg_net` 和 `vault`（界面中可能显示 `Supabase Cron` / `Vault`）。
2. 编辑 `setup/supabase_cron.sql`，把两个示例值改为 **已部署的** `https://域名/api/cron` 和 Vercel 中**完全一致**的 `CRON_SECRET`，再在 SQL Editor 执行一次。Vault 用来保存 secret，不要把真实密钥提交到 Git。
3. Cron 每分钟最多触发一个新批次，内部有 Postgres 租约和任务幂等标记。`queued → submitting → pending/polling → success/failed`。如果首次提交超时/状态不明，会标为 `submission_unknown`，不会擅自重复提交扣费任务。管理员可在任务详情中手动核实上游编号。
4. 检查 `cron.job_run_details` 和 Vercel → Logs。**视频任务预计以约 1 分钟粒度更新，而非原版 5 秒轮询**。客户端每 8 秒刷新 UI，不等于上游会被每 8 秒轮询。
5. 不要设置 Vercel Function `setInterval` 或依赖启动 Node Worker；Vercel 没有常驻进程。`api/cron.ts` 仅允许 `CRON_SECRET` Bearer POST。

## 4. 核心实现

- **GraphQL**：项目、组织、角色、成员管理、9 图 + 最多 3 音频/3 视频参考任务、加密独立 API 卡密、价格查询、审计记录。
- **用户登录**：Supabase Auth 负责邮箱与密码，Postgres `sessions` 存加密随机哈希，会话 Cookie 为 HttpOnly + SameSite=Lax + HTTPS Secure；与原 EXE 设备卡密不同。
- **大文件素材**：浏览器通过短期签名直传 Supabase Storage，Vercel Function 不接收大文件的 multipart body；服务端校验媒体大小、MIME 和文件魔数。默认 45 MB/文件。
- **视频提供商**：签发 4 小时的临时素材链接，JSON POST 给提供商，避免在 Vercel 读取整段素材；视频任务和上游计费/错误结果写入 Supabase Postgres。
- **备份/恢复**：工作区范围 SQL 快照及媒体 Storage 复制；恢复前自动执行安全快照，并拒绝恢复仍有活动任务的工作区。单次 60 个素材/5000 任务上限；**这不是 Supabase 平台的 PITR / 异地灾难恢复**。
- **原 EXE 服务控制**：本地 KillPort / 启停 / Docker Socket 操作**不适用 Vercel**，UI 显示为不可操作；真实部署/回滚和函数日志由 Vercel 托管。更新记录、发行通道、许可证邀请、审计、诊断仍保留。

## 5. 本地开发与验证

- 安装 Node.js 22、运行 `npm install`；在根目录设置 `.env`（参考 `.env.example`），并创建自己的 Supabase **开发项目**。
- `npx vercel dev` 使用真实 Vercel Functions 运行 API 和 Vite，可能需要先执行 `vercel link`；本地开发不依赖 Docker。
- `npm run typecheck`, `npm test`, `npm run build:web`。
- 访问 `/healthz`，进行注册/确认/登录、上传、创建演示任务、手动调用安全 Cron 端点、备份及恢复的完整集成测试。

## 风险 / 当前限制

- 这里交付**代码和部署配置**，尚未登录用户的 Vercel/Supabase 账号创建真实站点。
- 本环境不能连接 npm registry，因此无法安装依赖进行真实集成/构建测试；静态语法与纯逻辑验证不等同上线验证。
- 原启动器下载的剧本系统后端不在所给 ZIP 中，无法凭单一 EXE 复刻未提供的业务流程。
- 151 API 文档的原始地址是 `http://113.207.49.151:8045`，**卡密通过 HTTP 传输未加密**，上线前建议提供商配置可信 HTTPS 代理。
- 密码和会员会话存储与原 0.2 的自建用户体系不同，已有 0.2 账号需要迁移到 Supabase Auth，**不要不经转换直接复用原有生产账号**。

## 文件导航

`apps/web` React 界面；`apps/api/src/graphql` GraphQL resolvers；`apps/api/src/serverless` Web 标准 Functions 实现；`api/handler.ts`/`api/cron.ts` Vercel Entrypoints；`sql/` 数据库和 Cron SQL；`docs/` 原 EXE 逆向映射与接口文档。
