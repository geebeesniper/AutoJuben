# AutoJuben Cloud v0.3.0 — Vercel 发布和管理约定

## 标准发布流程

1. Git push 到连接的 GitHub 仓库。
2. Vercel 自动构建 `apps/web` 的静态站点，并编译根目录 `api/handler.ts`、`api/cron.ts` Functions。
3. 在 Vercel → Deployments 查看结果，验证 `/healthz`、GraphQL、Storage 及 Supabase Cron 日志。
4. 版本回滚请使用 Vercel Dashboard 的部署管理功能。不得依靠旧版 Windows 启动器的 `KillPort`、`StartBackend`、`StopFrontend` 或 Docker 管理。

## 平台管理员

可选环境变量：`PLATFORM_ADMIN_EMAILS=your-admin@example.com`。此邮箱对应的用户还必须是工作区 `owner`，才能管理发布记录和人工核实部署状态。

工作区发布记录只是 SaaS 管理元数据，**不会自动改变 Vercel 中已部署的代码**。

## 可选外部部署执行器（未实现执行器服务）

`DEPLOY_WEBHOOK_URL` 和 `DEPLOY_WEBHOOK_SECRET` 可指向组织自有的安全部署执行器。SaaS 将以 HMAC-SHA256 对请求体签名，并在执行器回复 `status: deployed` 且版本吻合时写入部署完成记录。该功能需要独立搭建安全执行器和验证完成状态，默认未启用。

## 备份

应用工作区备份写入 Supabase **私有** Storage，完成后保存 SHA-256 清单。恢复之前会建立安全快照。默认单次最多 60 项素材、5000 条视频任务；大规模恢复应使用 Supabase 自身的数据库恢复和对象备份方案。不要把下载的 `manifest.json` 当成包含媒体文件的完整备份。

部署步骤见项目根目录 `README.md`。
