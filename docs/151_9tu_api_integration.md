# 151 纯净版 9图视频 API 接入文档

版本：v1.0  
适用服务：151 代理专版视频生成 API  
推荐基础地址：`http://113.207.49.151:8045`

本文只描述对接方需要使用的稳定接口，不暴露内部存储、处理节点和调度实现。

## 1. 接入原则

1. 所有任务统一调用 `POST /api/generate-video`。
2. 所有任务都必须携带卡密鉴权，推荐使用请求头 `X-License-Key`。
3. 提交成功只代表任务已受理，最终结果必须轮询 `GET /api/task/{task_id}`。
4. 成功后优先读取 `video_url` 或 `stable_video_url`，不要自行拼接视频链接。
5. 每个业务任务建议传 `client_task_id`，用于防重复提交。
6. 素材推荐传公网 URL；服务端会统一处理素材下载、校验和稳定化。
7. 如果客户没有素材 URL，也可以直接 multipart 上传文件到本接口，服务端会统一处理。

## 2. 鉴权

推荐：

```http
X-License-Key: YOUR_LICENSE_KEY
```

也兼容：

```http
Authorization: Bearer YOUR_LICENSE_KEY
```

不推荐把卡密放在 URL 参数里，容易出现在日志和浏览器历史中。

## 3. 模型与价格

对接方不要写死价格，启动时或下单前读取：

```http
GET /api/pricing
```

当前推荐视频模型：

| 模型 ID | 用途 | 推荐分辨率 | 说明 |
|---|---|---:|---|
| `xinghe-2.0` | 标准 9图视频 | `720p` | 最完整，支持 `480p`、`720p`、`1080p`、`4k`，支持图片、音频、视频参考 |
| `xinghe-fast` | 快速低价版 | `480p` | 当前按 480P 输出，适合低价快速任务 |

实际开放状态以 `GET /api/public-settings` 和 `GET /api/pricing` 返回为准。

分辨率说明：

| 模型 ID | 支持分辨率 | 计费说明 |
|---|---|---|
| `xinghe-2.0` | `480p`、`720p`、`1080p`、`4k` | 720P 为基础价，1080P 按后台倍率计费，4K 按后台倍率计费 |
| `xinghe-fast` | `480p` | 固定 480P |

## 4. 通用参数

`POST /api/generate-video` 支持 `application/json`、`multipart/form-data`。

| 参数 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `prompt` | string | 是 | 生成提示词，建议写清角色、场景、镜头、动作、音效、对白 |
| `model` | string | 是 | 推荐 `xinghe-2.0` 或 `xinghe-fast` |
| `duration` | integer | 是 | 4 到 15 秒 |
| `ratio` | string | 是 | `9:16` 或 `16:9` |
| `resolution` | string | 否 | `480p`、`720p`、`1080p`、`4k`；以模型支持为准 |
| `client_task_id` | string | 强烈建议 | 幂等 ID，同一业务任务重复提交会返回原任务 |
| `image_urls` | array/string | 否 | 图片参考 URL，最多 9 张 |
| `audio_urls` | array/string | 否 | 音频参考 URL，最多 3 条 |
| `video_urls` | array/string | 否 | 视频参考 URL，最多 3 条 |
| `protect_stripe` | boolean | 否 | 星核人脸审核保护开关，默认按后台配置；需要关闭时传 `false` |

素材总数建议不超过 12 个：最多 9 张图片、3 条音频、3 条视频。  
音频参考建议至少配一张图片使用。  
复杂剧情任务建议优先用 `xinghe-2.0`。

## 5. URL 素材格式

最稳定的 JSON 写法：

```json
{
  "image_urls": [
    "https://example.com/ref-01.jpg",
    "https://example.com/ref-02.png"
  ],
  "audio_urls": [
    "https://example.com/audio-01.mp3"
  ],
  "video_urls": [
    "https://example.com/video-01.mp4"
  ]
}
```

也兼容字符串形式：

```json
{
  "image_urls": "[\"https://example.com/ref-01.jpg\",\"https://example.com/ref-02.jpg\"]"
}
```

推荐 URL 要求：

1. 使用 `https://` 或稳定可访问的 `http://`。
2. 不要依赖登录态、Cookie、防盗链 Referer。
3. 链接有效期建议大于 2 小时。
4. 文件名最好带正确后缀，如 `.jpg`、`.png`、`.mp3`、`.mp4`。
5. 同一个素材链接可以反复使用，服务端会尽量复用已处理素材。

## 6. 任务提交接口

```http
POST /api/generate-video
Content-Type: application/json
X-License-Key: YOUR_LICENSE_KEY
```

提交成功响应：

```json
{
  "status": "success",
  "task_id": "9e0b0b8a-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "client_task_id": "order-20260706-0001",
  "message": "video generation task submitted",
  "task_status": "pending",
  "progress": 0,
  "query_url": "/api/task/9e0b0b8a-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "events_url": "/api/task/9e0b0b8a-xxxx-xxxx-xxxx-xxxxxxxxxxxx/events",
  "required_credits": 50,
  "billing_status": "reserved",
  "wallet": {
    "balance": 1000
  }
}
```

字段说明：

| 字段 | 说明 |
|---|---|
| `task_id` | 平台任务 ID，后续轮询使用 |
| `client_task_id` | 客户传入的幂等 ID |
| `task_status` | 初始一般为 `pending` |
| `required_credits` | 本次预估消耗积分 |
| `billing_status` | `reserved` 表示积分已冻结，成功后扣费，失败会释放 |
| `query_url` | 查询任务状态地址 |

## 7. 查询任务状态

```http
GET /api/task/{task_id}
X-License-Key: YOUR_LICENSE_KEY
```

建议轮询策略：

1. 提交后等待 5 秒再开始轮询。
2. 前 2 分钟每 5 秒查询一次。
3. 之后每 10 到 15 秒查询一次。
4. 客户端最长等待建议 30 分钟；超过后继续后台轮询，不要重复提交。

处理中响应示例：

```json
{
  "task_id": "9e0b0b8a-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "polling",
  "progress": 40,
  "model": "xinghe-2.0",
  "billing_status": "reserved",
  "stable_video_url": "/api/video/9e0b0b8a-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
}
```

成功响应示例：

```json
{
  "task_id": "9e0b0b8a-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "success",
  "progress": 100,
  "model": "xinghe-2.0",
  "billing_status": "charged",
  "video_url": "https://example-public-cdn.com/path/video.mp4",
  "stable_video_url": "https://example-public-cdn.com/path/video.mp4",
  "mp4_url": "https://example-public-cdn.com/path/video.mp4"
}
```

失败响应示例：

```json
{
  "task_id": "9e0b0b8a-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "status": "failed",
  "billing_status": "released",
  "error_code": "PARAMS_INVALID",
  "error_stage": "media",
  "error_message": "素材无法下载，请更换可公开访问的素材链接后重试。"
}
```

## 8. 获取视频

成功后优先使用：

```text
video_url
```

如果 `video_url` 暂时为空，但任务已成功，可请求：

```http
GET /api/task/{task_id}/video-link
X-License-Key: YOUR_LICENSE_KEY
```

或者：

```http
GET /api/video/{task_id}
X-License-Key: YOUR_LICENSE_KEY
```

注意：`/api/video/{task_id}` 可能返回 302 跳转，客户端需要允许跟随跳转。

## 9. 四种标准场景

### 9.1 9图生成视频

适合：固定角色、固定场景、多图参考。

```bash
curl -X POST "http://113.207.49.151:8045/api/generate-video" \
  -H "Content-Type: application/json" \
  -H "X-License-Key: YOUR_LICENSE_KEY" \
  -d '{
    "client_task_id": "order-9img-001",
    "model": "xinghe-2.0",
    "duration": 15,
    "ratio": "9:16",
    "resolution": "720p",
    "prompt": "A cinematic vertical drama scene. Use the reference images to keep characters and location consistent. No subtitles. Natural camera movement, realistic lighting.",
    "image_urls": [
      "https://example.com/image-01.jpg",
      "https://example.com/image-02.jpg",
      "https://example.com/image-03.jpg",
      "https://example.com/image-04.jpg",
      "https://example.com/image-05.jpg",
      "https://example.com/image-06.jpg",
      "https://example.com/image-07.jpg",
      "https://example.com/image-08.jpg",
      "https://example.com/image-09.jpg"
    ]
  }'
```

### 9.2 9图 + 音频

适合：带对白、旁白、音效参考。

```bash
curl -X POST "http://113.207.49.151:8045/api/generate-video" \
  -H "Content-Type: application/json" \
  -H "X-License-Key: YOUR_LICENSE_KEY" \
  -d '{
    "client_task_id": "order-9img-audio-001",
    "model": "xinghe-2.0",
    "duration": 15,
    "ratio": "9:16",
    "resolution": "720p",
    "prompt": "Create a realistic vertical drama video. Match the character appearance from the images and use the reference audio for timing and voice feeling. No subtitles.",
    "image_urls": [
      "https://example.com/image-01.jpg",
      "https://example.com/image-02.jpg",
      "https://example.com/image-03.jpg"
    ],
    "audio_urls": [
      "https://example.com/dialogue-01.mp3",
      "https://example.com/dialogue-02.mp3",
      "https://example.com/sfx-01.mp3"
    ]
  }'
```

### 9.3 9图 + 视频

适合：用视频做动作、镜头、节奏参考。

```bash
curl -X POST "http://113.207.49.151:8045/api/generate-video" \
  -H "Content-Type: application/json" \
  -H "X-License-Key: YOUR_LICENSE_KEY" \
  -d '{
    "client_task_id": "order-9img-video-001",
    "model": "xinghe-2.0",
    "duration": 15,
    "ratio": "9:16",
    "resolution": "720p",
    "prompt": "Generate a cinematic vertical video. Keep the characters from the images. Use the reference video only for camera movement and action rhythm. No subtitles.",
    "image_urls": [
      "https://example.com/image-01.jpg",
      "https://example.com/image-02.jpg",
      "https://example.com/image-03.jpg"
    ],
    "video_urls": [
      "https://example.com/reference-motion-01.mp4"
    ]
  }'
```

### 9.4 9图 + 音频 + 视频

适合：完整短剧片段，图片定角色/场景，音频定声音，视频定运动。

```bash
curl -X POST "http://113.207.49.151:8045/api/generate-video" \
  -H "Content-Type: application/json" \
  -H "X-License-Key: YOUR_LICENSE_KEY" \
  -d '{
    "client_task_id": "order-full-ref-001",
    "model": "xinghe-2.0",
    "duration": 15,
    "ratio": "9:16",
    "resolution": "720p",
    "prompt": "Create a realistic vertical short-drama scene. Use image references for character identity and scene layout, audio references for voice and rhythm, and video reference for camera movement. Keep the output clean, no subtitles, no watermark.",
    "image_urls": [
      "https://example.com/character-01.jpg",
      "https://example.com/character-02.jpg",
      "https://example.com/scene-01.jpg"
    ],
    "audio_urls": [
      "https://example.com/dialogue-01.mp3",
      "https://example.com/sfx-01.mp3"
    ],
    "video_urls": [
      "https://example.com/camera-motion-01.mp4"
    ]
  }'
```

## 10. Multipart 文件上传

如果客户没有公网素材 URL，可以直接上传文件。

字段名：

| 字段 | 类型 | 说明 |
|---|---|---|
| `images` 或 `files` | file[] | 图片素材 |
| `audios` 或 `files` | file[] | 音频素材 |
| `videos` 或 `files` | file[] | 视频素材 |
| `reference_videos` | file[] | 参考视频 |

示例：

```bash
curl -X POST "http://113.207.49.151:8045/api/generate-video" \
  -H "X-License-Key: YOUR_LICENSE_KEY" \
  -F "client_task_id=order-upload-001" \
  -F "model=xinghe-2.0" \
  -F "duration=15" \
  -F "ratio=9:16" \
  -F "resolution=720p" \
  -F "prompt=Realistic vertical drama scene, no subtitles." \
  -F "images=@./image-01.jpg" \
  -F "images=@./image-02.jpg" \
  -F "audios=@./dialogue-01.mp3" \
  -F "videos=@./motion-01.mp4"
```

为了稳定和速度，批量客户仍建议尽量传素材 URL。

## 11. Python 稳定轮询示例

```python
import time
import requests

BASE_URL = "http://113.207.49.151:8045"
LICENSE_KEY = "YOUR_LICENSE_KEY"

headers = {
    "X-License-Key": LICENSE_KEY,
    "Content-Type": "application/json",
}

payload = {
    "client_task_id": "order-python-001",
    "model": "xinghe-2.0",
    "duration": 15,
    "ratio": "9:16",
    "resolution": "720p",
    "prompt": "Realistic vertical drama scene. No subtitles.",
    "image_urls": [
        "https://example.com/image-01.jpg",
        "https://example.com/image-02.jpg",
    ],
}

submit = requests.post(f"{BASE_URL}/api/generate-video", headers=headers, json=payload, timeout=60)
submit.raise_for_status()
result = submit.json()

if result.get("status") != "success":
    raise RuntimeError(result)

task_id = result["task_id"]

time.sleep(5)
for _ in range(240):
    resp = requests.get(
        f"{BASE_URL}/api/task/{task_id}",
        headers={"X-License-Key": LICENSE_KEY},
        timeout=30,
    )
    resp.raise_for_status()
    task = resp.json()
    status = task.get("status")

    if status == "success":
        print(task.get("video_url") or task.get("stable_video_url") or task.get("mp4_url"))
        break

    if status == "failed":
        raise RuntimeError(task.get("error_message") or task)

    time.sleep(10)
else:
    print("任务仍在生成中，请后台继续轮询，不要重复提交。")
```

## 12. 常见错误处理

| 错误 | 处理 |
|---|---|
| `PARAMS_INVALID` | 检查必填参数、模型、时长、比例、素材数量 |
| `MODEL_UNAVAILABLE` | 模型维护或已关闭，读取 `/api/public-settings` 后切换模型 |
| `INSUFFICIENT_CREDITS` | 卡密余额不足，需要充值 |
| `REQUEST_TOO_LARGE` | 单次 multipart 请求过大，改用 URL 素材或压缩素材 |
| 素材无法下载 | 更换公网可访问链接，确认链接未过期、无防盗链 |
| 内容审核失败 | 调整提示词或更换素材 |
| `VIDEO_NOT_READY` | 视频还没完成，继续轮询任务状态 |

## 13. 最稳定提交规范

1. 每个任务都传 `client_task_id`。
2. 图片、音频、视频素材优先用 URL 数组提交。
3. URL 链接有效期至少 2 小时。
4. 不要在 30 秒内重复提交同一个任务；查原 `client_task_id` 对应结果。
5. 单个卡密并发不要超过后台给该卡密设置的并发上限。
6. 轮询频率不要低于 5 秒一次，避免把 API 打慢。
7. 成功后保存 `video_url`，不要每次都重新请求视频链接。
8. 失败后不要盲目自动重试，先看 `error_message`。素材下载失败、审核失败、参数非法需要改素材或参数。

## 14. 推荐提示词结构

```text
角色说明：图1是角色A，图2是角色B，图3是场景。
整体风格：拟真人写实，电影质感，真实光影，无字幕，无水印。
镜头要求：竖屏9:16，中景到特写，镜头运动自然。
动作节奏：0-5秒..., 5-10秒..., 10-15秒...
音频要求：参考音频用于对白/音效节奏。
视频参考：参考视频仅用于动作和镜头运动，不改变角色身份。
限制：不要出现字幕，不要出现额外人物，不要改变角色服装和脸型。
```

## 15. 最小生产接入清单

上线前至少测试：

1. 纯 9 图：`image_urls` 3 到 9 张。
2. 9 图 + 音频：`image_urls` + `audio_urls`。
3. 9 图 + 视频：`image_urls` + `video_urls`。
4. 9 图 + 音频 + 视频：三类素材同时传。
5. 同一个 `client_task_id` 重复提交，确认不会产生重复扣费任务。
6. 任务成功后 `video_url` 可以直接下载或播放。
7. 任务失败后积分释放，错误信息能被业务端展示。
