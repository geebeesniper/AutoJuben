# AutoJubenLauncher.exe → SaaS：逐项对照与证据

分析对象：用户提供的 `win启动器0425.zip`（ZIP 内仅有 `AutoJubenLauncher.exe`，原文件 13,651,968 bytes）。**以下内容来自本地 EXE 的静态字符串/嵌入式 Wails React bundle 检查，未执行 Windows 程序。** 源 ZIP 中不包含安装后下载的真正 AutoJuben 剧本业务前端、业务后端或 `script_generator.db`。

Windows 程序前端可直接确认的 `window.go.app.Service.*` 方法一共 **24** 个（不是 26 个）。本 SaaS 的后端不是运行 EXE，也没有在浏览器中执行 Wails，而是使用 TypeScript/GraphQL 重建可迁移的工作流。

| 原 EXE 调用 | 原始行为（从前端可确认） | 新 SaaS 的实现 | 状态 / 差异 |
|---|---|---|---|
| `LoadConfig` | 载入本地配置 | `launcherStatus` 首次创建工作区配置 | 已重写，PostgreSQL |
| `GetStatus` | 安装、授权、前后端运行状态 | `launcherStatus` 真实查询受管 Docker 容器 | 已实现（需要实际容器绑定） |
| `GetSettings` | 读取安装位置、端口、环境、更新偏好 | `launcherStatus`, `providerInfo` | 已重写；不再暴露本机路径 |
| `SaveSettings` | 保存配置 | `launcherSavePreferences`, `saveProviderKey` | 已实现，租户隔离 |
| `SelectInstallDir` | 弹出 Windows 文件夹选择器 | 不适用 | 云端部署由平台运维配置 |
| `SetInstallDir` | 写入本机安装目录 | `launcherProvisionContainers` | 映射为受管服务绑定 |
| `CheckForUpdates` | 检查可用更新/灰度通道 | `launcherCheckUpdates` | 已实现，读取实际发布记录 |
| `InstallUpdate` | 下载并安装新版程序 | `launcherInstallRelease` | 需要 operator 部署 webhook；**不会假装升级成功** |
| `StartAll` | 启动本机前后端服务 | `launcherAllAction(start)` | 真实 Docker start，先后端再前端 |
| `StopAll` | 停止本机前后端服务 | `launcherAllAction(stop)` | 真实 Docker stop，先前端再后端 |
| `StartBackend` | 启动本机后端（默认 8000） | `launcherServiceAction(backend,start)` | 真实 Docker start |
| `StopBackend` | 停止本机后端 | `launcherServiceAction(backend,stop)` | 真实 Docker stop |
| `StartFrontend` | 启动本机前端（默认 3000） | `launcherServiceAction(frontend,start)` | 真实 Docker start |
| `StopFrontend` | 停止本机前端 | `launcherServiceAction(frontend,stop)` | 真实 Docker stop |
| `ForceKillPorts` | 强行结束占用端口的 Windows 进程 | **不提供** | SaaS 不允许通过浏览器对宿主机任意杀进程 |
| `KillPort` | 结束指定端口进程 | **不提供** | 使用受管容器重启，不采用任意端口清理 |
| `OpenBrowser` | 在本机打开浏览器 | SaaS 网址本身即浏览器页面 | 无需服务器远程操作浏览器 |
| `CopyLink` | 复制本机访问链接 | 运行中心“复制访问链接” | 已实现，使用 HTTPS 域名/当前 origin |
| `GetLogs` | 监控日志、按后端/前端过滤 | `launcherContainerLogs`, `launcherEvents` | 真正 Docker 日志 + PG 操作日志 |
| `ExportDiagnostics` | 导出本机诊断压缩包 | `/api/launcher/diagnostics` | 下载工作区诊断 JSON，不是原 ZIP 格式 |
| `ListDbBackups` | 列出 `script_generator.db` 历史备份 | `launcherBackups` | PG 应用业务数据及媒体文件备份，不是原 SQLite |
| `RestoreDbBackup` | 恢复历史数据库、先备份当前库 | `launcherRestoreBackup` | 实现安全快照/校验/事务性数据恢复；与原 SQLite 格式不兼容 |
| `ActivateUser` | 用户名、激活码，本机离线许可文件 | `launcherRedeemActivation` | **新的 SaaS 工作区加入码**，非原授权协议 |
| `IssueLicenseByActivationCode` | 使用管理员 Token 签发本地授权（联调） | `launcherIssueActivation` | SaaS 成员注册码（160 位随机），非原管理员 Token |

## 从 EXE 前端还确认了什么

- 原 UI：`控制台`、`基本设置`、`服务控制`、`数据库备份`、`运行监控`、`许可证激活`。
- 默认本机端口：后端 8000、前端 3000；本机开发联调 API `127.0.0.1:9099`。
- 更新设置：正式/开发环境、Stable/Beta、灰度测试；新版支持独立的 `gray` 通道。
- 原启动器可以启动或停止安装后下载的业务模块；**后续业务模块并不包含在所上传的 EXE 压缩包内**。

## 新增 SaaS 基础能力

- TypeScript / React Web 客户端；TypeScript GraphQL Yoga API，PostgreSQL。
- 账户密码、服务端会话 Cookie、组织、成员权限、操作审计。
- 受管容器实际状态/启停/日志，运维白名单绑定，服务版本发布，带签名部署执行器。
- 工作区激活码签发、撤销、限次、过期及登录后兑换。
- 备份项目、视频任务、上传素材；媒体 SHA-256 检查；恢复前自动创建快照；活动任务未结束时拒绝恢复。
- 151 视频 API 参考图/音频/视频混合生成、幂等任务、队列和计费状态（沿用本项目 v0.1.x 的实现）。

## 明确不属于真实原程序“已复刻”的内容

1. **完整 AutoJuben 剧本系统的业务逻辑、提示词、数据库表、下载包**：原 EXE 不含这部分代码；新项目没有伪称复刻。
2. **原来授权服务器的卡密兼容**：原签名公钥、管理员 Token 及许可证格式未移植到 SaaS；新发的工作区加入码不能拿去激活旧 EXE。
3. **原本软件的版本包安装逻辑**：云端使用配置的发布/部署执行器；不会任意下载未验证 EXE 并在服务器执行。
4. **Windows 本地目录/端口操作**：这些本机运维概念在 Web SaaS 中没有安全等价项。
5. **真实生产集成测试**：无真实业务后端、视频卡密或可用 Docker/PG/NPM 网络环境，无法声明已经真实端到端运行。
