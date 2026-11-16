# AutoJuben Cloud SaaS v0.4.0

**基于上一版 v0.3.0 的完整增量重构。** TypeScript + React 前端、TypeScript + GraphQL Yoga 后端，部署到 **Vercel + Supabase (PostgreSQL/Auth/Storage)**。新增客户门户、平台管理员后台和 Stripe 支付网关。项目仍包含原版 EXE 启动器迁移的部署/许可证/备份相关功能，以及 151 视频 API 多参考素材生成。

> 本压缩包是**可部署源码**，不是已部署网站。没有 Stripe 真实密钥、Supabase 项目及网络环境时无法验证真实支付、邮件、Vercel 构建或视频生产调用。不要在验证前直接上线收款。

## 项目结构

| 目录 | 内容 |
| --- | --- |
| `apps/web/src/pages/Auth.tsx` | 登录 / 注册 / 找回密码 / 重设密码 |
| `apps/web/src/pages/Portal.tsx` | 客户账户、活动 History、支付方式、购买记录、购买积分 |
| `apps/web/src/pages/Admin.tsx` | 平台用户搜索、交易、Stripe 网关、商品、视频定价、API 设置 |
| `apps/api/src/graphql/portal.ts` | 客户门户 GraphQL Query / Mutation |
| `apps/api/src/graphql/admin.ts` | 仅平台管理员可调用的管理操作 |
| `apps/api/src/billing/stripe.ts` | Stripe Checkout、Customer Portal、卡片信息、签名 Webhook、退款同步 |
| `apps/api/src/billing/common.ts` | 计费配置、账本事务、任务积分释放 |
| `apps/api/src/serverless/auth.ts` | Supabase Auth 验证，服务端 Cookie Session，找回密码邮件 |
| `api/stripe.ts` | Vercel 原始 Webhook 请求入口，POST `/api/stripe` |
| `sql/004_customer_portal_payments.sql` | 新增的客户账单与后台设置数据库迁移 |
| `setup/supabase_cron.sql` | 定时视频队列 + 延迟退款对账 |

## 前端功能

**客户门户（每个登录用户）**

- 登录、注册、发送密码重设邮件、从邮件链接修改密码（Supabase Auth），并使用已验证的重置会话撤销原有服务端登录会话。
- 账户资料：查看邮箱、修改显示名、邮件重设密码。
- History：按工作区显示自己的登录/创作/项目/管理操作日志；视频任务与结果仍在「生成任务」。
- 信用卡：仅查看 Stripe 已保存卡片的**品牌、尾号 4 位、有效期**。修改、增加、删除卡片使用 **Stripe Customer Portal**；**不保存 PAN/CVV**。
- 购买记录：只显示自己的历史订单、支付状态、退款金额与时间。
- 购买积分：仅工作区 Owner/Admin 可以购买，浏览器跳转 Stripe Checkout；订单和积分在 Stripe Webhook 验证之后才标记成功。
- 工作区积分余额：多成员共享；管理员可选择是否让视频任务消耗本地积分。

**平台管理员后台**

- 使用环境变量 `PLATFORM_ADMIN_EMAILS` 明确授权平台管理员（不是任何工作区 Owner）。
- 搜索用户、账户停用/恢复、查看工作区数量及订单数量。
- 搜索跨客户订单和支付/退款状态；退款操作在 Stripe Dashboard 进行并由 Webhook 同步。
- 设置 Stripe Secret Key、Webhook Signing Secret、Portal Configuration ID（AES-256-GCM 加密保存或使用 Vercel 环境变量）；测试 Stripe API 连接。
- 管理积分商品的 SKU、名称、描述、美元金额、积分数和上架状态。
- 管理视频模型/分辨率对应本地积分价格；开启或暂停付款及任务积分扣费。
- 设置全平台默认 151 视频 API 卡密；查看 API Base URL 与模拟/生产模式、测试 `/api/pricing`。

## 一次性部署准备

### 1. Supabase

创建新的 Supabase 项目，按顺序在 SQL Editor 运行：

1. `sql/001_initial.sql`
2. `sql/002_launcher_port.sql`
3. `sql/003_supabase_vercel.sql`
4. **`sql/004_customer_portal_payments.sql`**

**如果已经部署过 v0.3.0，只运行第 4 份新增 SQL 即可。** 确保以前的数据库迁移全部成功。

在 Supabase Storage 创建 **private** bucket：`autojuben-media`。Auth 中启用 Email + Password，并配置正确的 Site URL、允许重定向 URL `https://YOUR-SITE.vercel.app/?auth=reset`。生产邮件通知应配置自定义 SMTP。用户和业务表的 RLS 继续按 v0.3.0 的私有服务器 API 策略执行；切勿为 `purchase_orders`、`credit_wallets`、`billing_customers` 等开放 anon 读写策略。

### 2. Vercel

将整个仓库推送到 GitHub，Vercel 选择仓库**根目录**导入，框架 Vite，使用根目录 `vercel.json`。

在 Vercel Environment Variables 中录入（不要把密钥写入 Git）：

```dotenv
PUBLIC_ORIGIN=https://YOUR-SITE.vercel.app
DATABASE_URL=postgresql://...:6543/postgres?sslmode=require
SUPABASE_URL=https://PROJECT.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_STORAGE_BUCKET=autojuben-media
VITE_SUPABASE_URL=https://PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
PLATFORM_ADMIN_EMAILS=your-verified-admin@example.com
ENCRYPTION_KEY=<base64-of-32-random-bytes>
CRON_SECRET=<long-random-token-at-least-32-chars>
MOCK_VIDEO_PROVIDER=true
VIDEO_API_BASE_URL=http://113.207.49.151:8045
ALLOW_INSECURE_VIDEO_HTTP=false
```

`STRIPE_SECRET_KEY`、`STRIPE_WEBHOOK_SECRET`、`STRIPE_PORTAL_CONFIGURATION_ID` 可在 Vercel 环境变量设置，或者由已登录的**平台管理员**在 Web 管理后台加密录入；数据库保存的密钥优先于环境变量。`ENCRYPTION_KEY` 丢失或更换后，旧加密密钥无法解密，请安全备份。

**本地开发**：`npm install` → `npm run typecheck` → `npm run build`；需要服务端 API 时使用 `npx vercel dev`。前端单独启动 `npm run dev:web` 不会自动启动后端 Functions。

### 3. 创建平台管理员

使用 Supabase 登录流程注册并验证 `PLATFORM_ADMIN_EMAILS` 指定的邮箱，再登录。侧栏出现 **PLATFORM ADMIN** 区域。**工作区 Owner 不能自动获得平台级权限。**

### 4. 配置 Stripe Payment Gateway

1. 先使用 Stripe **Test Mode**，从 Stripe Dashboard 获取测试 `sk_test_...`。
2. Stripe Webhooks 添加端点：`https://YOUR-SITE.vercel.app/api/stripe`，订阅：
   - `checkout.session.completed`
   - `checkout.session.async_payment_succeeded`
   - `checkout.session.async_payment_failed`
   - `checkout.session.expired`
   - `charge.refunded`
3. 保存端点生成的 `whsec_...`（Webhook Signing Secret）。注意此密钥不同于 Secret Key。
4. 在 **Stripe Customer Portal** 配置中启用 **Payment method updates**；复制 `bpc_...` 的配置 ID 保存到管理后台，否则托管页面可能不支持修改卡片。
5. 在管理员后台「支付网关」保存上述配置，按「测试 Stripe 连接」，创建并上架至少一个积分商品。
6. 先打开 **允许积分购买**，使用 Stripe 测试支付验证 Webhook；根据自己的盈利和定价策略设置视频任务积分价格，再选择性开启 **按视频任务扣费**。
7. 用测试环境核查付款、购买记录、重复 Webhook、失败交易、退款回退积分、客户 Portal 卡片功能；全部通过后再切换到 `sk_live_...` 并**同步替换成 Live 模式对应的 `whsec_...`**。

**信用卡安全：** AutoJuben 不处理/保存完整卡号、CVV 或账单卡片原始输入；用户跳转 Stripe 托管结账与托管账户门户。只在前端显示品牌、末四位和有效期，且仅本人可读取。不要把密钥放入 `VITE_` 变量、数据库明文或源码。

**积分不是上游扣费：**本平台账本中的积分属于 AutoJuben 业务积分，与 151 视频 API 的积分余额独立。开启视频积分扣费后，提交任务时预扣本地积分；确认失败时退回，成功时确认。上游提交状态未知时保持预扣，需管理员核实以避免两边重复扣款。退款将从工作区账本扣回相应积分，可能产生负余额；余额不足时不能新建付费任务。

### 5. 视频 API 与定时任务

视频 API 最好使用**提供 HTTPS 的服务商地址**。文档给出的默认 `http://113.207.49.151:8045` 是明文地址；生产环境默认阻止向 HTTP 发送卡密。确实无法升级且充分了解风险时，可以显式设置 `ALLOW_INSECURE_VIDEO_HTTP=true`，但强烈不推荐。设置 `MOCK_VIDEO_PROVIDER=false` 后才会请求真实视频服务。可在工作区级别设置覆盖卡密，或者在管理员后台设置全局卡密。

视频任务由 Supabase Cron 触发 `/api/cron` 的 Vercel Function。参见 `setup/supabase_cron.sql`。这个 Cron 同时处理极少数发生乱序回调时的**待同步退款**。

## API / 路由

- `/app`：客户工作区与账号门户；`/admin`：平台管理门户。均为同一个 React SPA，但后台管理接口在 GraphQL 上独立校验权限。

- `POST /graphql`：所有读写业务接口；要求有效 HttpOnly `aj_session` 和同源写请求。
- `POST /auth/login`、`POST /auth/register`、`POST /auth/forgot-password`、`POST /auth/revoke-sessions`、`POST /auth/logout`、`GET /auth/me`。
- `POST /api/stripe`：仅接收 Stripe 带签名的原始 Webhook；不需要/不使用客户 Cookie。
- `POST /api/cron`：仅接受 `Authorization: Bearer CRON_SECRET`（Supabase Cron 调用）。
- `GET /healthz`：部署/数据库健康检查。

GraphQL SDL 新增定义位于 `apps/api/src/graphql/portal.ts` 和 `admin.ts`。所有跨用户的后台操作均在**服务端**重新校验平台管理员身份；隐藏菜单只是 UX，并不是授权安全边界。

## 测试与已知限制

- 完成 TypeScript/TSX 源码的**语法解析和相对模块路径静态检查**。
- `billing/rules.ts` 的**6 项退款/积分计算独立测试**已在本地运行通过；真实 Stripe Webhook / PostgreSQL 事务尚未运行。
- 当前离线容器的 npm 依赖无法下载，**没有完成 npm 类型检查、Vite 构建、数据库联调、实际 Stripe/Video API 交易测试**。这些必须在有网络和密钥的环境中继续执行。
- 仅接入 **Stripe 一次性 Checkout**；未实现 PayPal、订阅扣款、自动开票、税务计算或内置的客服退款审批流程。
- 与旧 EXE 的关系：启动器可识别的功能按 v0.2/v0.3 已迁移；原 EXE 后续下载的剧本业务系统并未包含在上传 ZIP 中，所以不能声称 1:1 重建那些缺失的业务逻辑。详见 `docs/exe-reconstruction-and-parity.md`。

**重要：项目不能在支付验证和权限安全复核完成之前视为生产可上线版本。**
