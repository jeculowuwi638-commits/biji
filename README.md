# 笔迹 · 你的个人 AI 写作分身

> 让 AI 学会你的表达方式。

笔迹不是又一个“输入题目、输出文章”的生成器。它先从你过去写过的 3–10 篇文章里提取一份**不可手改、可继续投喂的写作档案**，再带着这份档案写作，最后检测这篇稿子“像不像你”，并按具体问题重写。

---

## 一、本机启动（Node.js + MySQL）

项目按**本地 Node.js + MySQL** 运行。首次启动需要创建数据库、配置一次 `backend/.env`，之后直接启动后端即可。生成、重写和档案语义分析都依赖大模型，**必须配置 `LLM_API_KEY`**；未配置时这些接口会明确报错。

> 下文命令默认在项目根目录（包含 `backend/`、`frontend/` 的目录）执行。

### 下载后首次启动

从 Gitee 克隆到本地：

```powershell
git clone https://gitee.com/p-jiaxin11111/biji.git
cd biji
```

然后依次完成下面 1–4 步：

1. 创建 MySQL 数据库和账号（只需一次）；
2. 复制 `backend/.env.example` 为 `backend/.env`，填写自己的 `LLM_API_KEY`；
3. 在 `backend` 安装依赖，执行 Prisma 迁移和种子数据；
4. 在 `frontend` 安装依赖并构建。

最后执行 `cd backend && npm start`，打开 **http://localhost:3000**，用 `demo / demo1234` 登录。完整命令见下方各步骤。

### 前置条件

- Node.js 20 或更高版本：`node -v`
- MySQL 8.0 已安装并正在运行，默认端口 `3306`
- Windows 下 MySQL 服务名通常为 `MySQL80`；如果服务未启动，可在管理员 PowerShell 中执行：

```powershell
Get-Service MySQL80
Start-Service MySQL80
```

### 1. 创建数据库和账号

打开 MySQL 命令行（需要输入本机 MySQL 的 root 密码）：

```powershell
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p
```

进入 MySQL 后执行：

```sql
CREATE DATABASE IF NOT EXISTS biji
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'biji'@'localhost' IDENTIFIED BY 'biji_password';
CREATE USER IF NOT EXISTS 'biji'@'127.0.0.1' IDENTIFIED BY 'biji_password';
GRANT ALL PRIVILEGES ON biji.* TO 'biji'@'localhost';
GRANT ALL PRIVILEGES ON biji.* TO 'biji'@'127.0.0.1';
FLUSH PRIVILEGES;
EXIT;
```

也可以使用 Navicat 等图形客户端执行这段 SQL。Navicat 只是客户端，**自动建表由后面的 Prisma Migration 完成**。

或者直接执行仓库里的初始化脚本（会提示输入 MySQL root 密码）：

```powershell
# 在项目根目录执行
& "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "source backend/scripts/init-db.sql"
```

### 2. 配置后端环境变量

```powershell
cd backend
Copy-Item .env.example .env
notepad .env
```

确认 `DATABASE_URL` 是：

```dotenv
DATABASE_URL=mysql://biji:biji_password@127.0.0.1:3306/biji
```

同一个文件里还有 `PORT`、`JWT_SECRET` 和大模型配置。`LLM_API_KEY` 留空时，生成、重写和档案分析都会返回 `503 LLM_NOT_CONFIGURED`，因此正式使用前必须填写。

### 3. 安装依赖、迁移数据库、初始化演示数据

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
npm run seed
```

- `npm run prisma:migrate` 实际执行 `prisma migrate deploy`，会读取 `backend/src/prisma/migrations` 自动建表，并记录到 `_prisma_migrations`。重复执行是安全的，只会应用尚未执行的迁移。
- `npm run seed` 会创建演示账号 `demo / demo1234` 和两份预置档案，并保存它们的原始语料。已有旧演示档案如果没有原文，seed 会自动回填，使它们也能继续投喂。

### 4. 构建前端并启动

首次运行、或修改过前端代码后，先构建一次前端：

```powershell
cd frontend
npm install
npm run build
```

然后启动后端：

```powershell
cd backend
npm start
```

打开 **http://localhost:3000**。

演示账号：

```text
账号：demo
密码：demo1234
```

后端启动日志会显示当前端口、模型状态和档案语义缓存条目数。也可以访问 `http://localhost:3000/api/health` 检查 API、数据库、语义缓存和模型配置状态。

> 第二次以后不需要重复迁移和初始化，进入 `backend` 执行 `npm start` 即可。
>
> 如果页面只显示一行“笔迹 API 正在运行”，说明 `frontend/dist` 不存在或未构建成功，回到第 4 步执行 `npm run build`。

### 5. 常见问题

| 现象 | 处理 |
| --- | --- |
| `Access denied for user 'biji'@...` | 检查 MySQL 账号、密码和 host；重新执行第 1 步 SQL，确认 `backend/.env` 中密码一致 |
| `Can't reach database server` / Prisma `P1001` | 确认 `MySQL80` 服务正在运行，端口 `3306` 可连接 |
| 页面显示 API 文本而不是登录页 | 前端未构建，执行 `cd frontend && npm install && npm run build` |
| `3000` 端口被占用 | 修改 `backend/.env` 中的 `PORT`；如果同时使用 Vite 开发模式，还要修改 `frontend/vite.config.js` 的代理目标 |
| 生成/重写/新建档案提示 `LLM_NOT_CONFIGURED` | `backend/.env` 中的 `LLM_API_KEY` 为空或无效；填写后重启后端 |
| 模型返回 `LLM_ERROR` | 检查网络、`LLM_BASE_URL`、模型名与账户额度；Key 无权限时也会归入该错误 |

---

## 二、配置 Key 后的演示脚本（建议按顺序验收）

> 以下流程需要先在 `backend/.env` 中配置有效的 `LLM_API_KEY` 并重启后端。生成与重写每次都会真实调用模型，正文和分数以实际输出为准；档案语义分析在命中预热语料时不会额外调用。

### 1. 登录与预置档案

使用 `demo / demo1234` 登录后进入「笔迹档案」。演示账号已经有两份可继续投喂的档案：

- **工作风格**：正式、偏书面、句子较长，关注流程与协作。
- **随笔生活**：口语、短句、个人经历多，情绪和比喻更明显。

在「新建档案」页点击「用演示语料试一份」，可以再创建一份 **观点评论** 档案；这组演示语料已预热语义缓存，不会产生额外的模型调用。自定义语料会真实调用模型。

### 2. 生成、检测、重写闭环

进入「开始写作」，点击右上角或空状态里的 **「载入演示设置」**。它会自动填入：

- 主题：把下班后的两个小时留给写作，也拒绝几场不想去的饭局；
- 平台：公众号；
- 档案：随笔生活；
- 微调：关闭（滑块保留 25 / 60 / 35 / 60 的演示值，打开开关即可复用）。

点击 **「生成这一篇」**，等待模型返回正文（通常 10–40 秒）。然后点击 **「检测像不像你」**：

| 阶段 | 预期结果 |
| --- | --- |
| 首次检测 | 显示总分、AI 味、个人贴合（有档案时）和句级问题 |
| 第 1 轮「按问题重写并复检」 | 整篇重写并复检；候选分比原稿低 5 分以内仍采用（提示小幅下降），低超过 5 分时保留原稿并提示“本轮改写未提升” |
| 第 2 轮重写并复检 | 同上；达到 2 轮上限后按钮禁用 |
| 重写后 | 只有采用改写稿时才出现左右对照面板，可比较前后正文与分数 |

正文中带下划线的句子就是问题定位，点击可跳到右侧对应的问题说明。分数由本地规则实时计算，会随每次模型输出变化，不承诺固定数值。

> 每次生成和重写都会真实调用模型；未配置 Key 时接口明确返回 `LLM_NOT_CONFIGURED`。重写候选分比原稿低超过 5 分时，后端保留原稿，避免“越改越低”；5 分以内的小幅波动会采用改写稿。

### 3. 三平台确实不同

保持演示主题和「随笔生活」档案，依次切换平台并生成：

| 平台 | 篇幅目标 | 预期结果 |
| --- | --- | --- |
| 公众号 | 800–1500 字 | 完整叙事 |
| 小红书 | 300–500 字 | 短段落 + emoji + 话题标签 |
| 抖音脚本 | 350–600 字 | 分镜画面提示 + 口播 |

三份结果在结构、语气和段落节奏上明显不同。

### 4. 档案差异与普通 AI 对照组

仍使用公众号和演示主题，只切换「用哪份笔迹」：

| 档案 | 预期 |
| --- | --- |
| 不使用档案 | 普通 AI 对照组，只计算通用 AI 味，通常分数最低 |
| 工作风格 | 正式、流程化表达与档案吻合，通常分数较高 |
| 随笔生活 | 口语和生活细节接近，分数视本次模型输出而定 |

实际分数会随每次生成变化，表中的相对关系用于验收，不是固定数值。“不使用档案”时，检测面板不显示个人贴合度，只显示通用 AI 味问题。

### 5. 微调开关

重新载入演示设置后，打开「要不要微调」：

- 关闭时：滑块不渲染，也不会写入提示词；
- 打开时：四个滑块出现，值仍是演示值；
- 再次生成会得到一篇新的正文，可与关闭微调的版本直接对比；
- 微调只影响本次生成，不会改动档案。

### 6. 档案的创建、查看、追加、重命名与删除

- 新建档案必须提供 **3–10 篇**文章，每篇至少 20 字；
- 档案的统计结果和语义摘要不能手动编辑，详情页没有“编辑内容”入口；
- 详情页的 **「查看文章」** 可以查看已经投喂的全部原文；
- 详情页的 **「继续投喂」** 可以一次追加 **1–10 篇**新文章，系统会把新文章与已保存原文合并，重新计算统计层和语义层；
- 追加后档案最多保存 **20 篇 / 60000 字**；更新结果会立即用于后续生成和检测；
- 演示账号可以点击追加弹窗里的 **「填入演示追加」**；这组组合已预热语义缓存，但仍需配置 `LLM_API_KEY` 才能完成分析。自定义文章同样需要 Key；
- 后端只允许通过 `PATCH /api/profiles/:id` 重命名；尝试直接修改 `stats`、`semantic` 或原文会返回 `PROFILE_READONLY`，追加必须走 `POST /api/profiles/:id/append`；
- 旧版本创建的档案没有保存原文，无法追加；演示档案会由 seed 自动回填，其他旧档案请新建一份；
- 可以创建多份档案，并在写作时任选一份；
- 删除档案会同时删除保存的原文，且不会影响其他账号的数据。

### 7. 账号与数据隔离

在登录页注册第二个账号，新建自己的档案并生成内容。再退出登录、切回 `demo`：两个账号的档案和生成记录互不可见。后端所有受保护接口都经过 JWT 认证，查询和写入均带 `userId` 条件。

### 3 分钟现场演示路线

| 时间 | 内容 |
| --- | --- |
| 0:00–0:20 | 问题：AI 写出来的东西，为什么不像你；念一句典型 AI 开头 |
| 0:20–0:50 | 多副笔迹：打开「工作风格」与「随笔生活」，对比笔迹档案，并演示查看文章 / 继续投喂 |
| 0:50–1:40 | 三版对比：同一主题，无档案 / 工作风格 / 随笔生活各生成一次 |
| 1:40–2:10 | 微调：随笔生活 + 打开微调，重新生成，对比措辞变化 |
| 2:10–3:00 | 检测：指出下划线句 → 按问题整篇重写 → 展示“降 5 分以内采用、明显降分保留原稿”的保护 |

---

## 三、配置真实大模型

默认接口是 OpenAI 兼容格式。以 DeepSeek 为例，编辑 `backend/.env`：

```dotenv
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_API_KEY=sk-你的真实Key
LLM_MODEL=deepseek-v4-flash
LLM_THINKING=disabled
```

保存后重启后端：

```powershell
cd backend
npm start
```

如果正在使用 `npm run dev`，同样需要重启进程，因为环境变量只在启动时读取。

配置 Key 后：

- 生成、重写每次都会真实调用模型，不读也不写缓存；
- 档案语义分析（新建 / 追加）先查预热缓存，未命中才调用模型并写回；
- 检测和评分仍然是本地规则计算，不消耗模型调用。

`deepseek-v4-flash` 是 DeepSeek-V4.1-Flash 的兼容别名；官方当前模型名是 `deepseek-flash`，两者可互换。若账户提示模型不存在，把 `LLM_MODEL` 改成 `deepseek-flash` 即可。

DeepSeek V4 默认开启思考模式。写作和档案分析不需要推理过程，`LLM_THINKING=disabled` 会关闭它，显著降低延迟和费用；换成其他兼容服务时留空即可。

也可以把 `LLM_BASE_URL` / `LLM_MODEL` 换成任何兼容 OpenAI Chat Completions 的服务。

---

## 四、档案语义分析缓存

- 文件：`backend/data/llm_cache.json`
- 键：`md5(model|temperature|system|user)`
- 仅用于档案语义分析，当前预置 **3 条**：

| 类型 | 数量 | 覆盖路径 |
| --- | --- | --- |
| 档案语义分析 | 1 | 演示语料「观点评论」 |
| 档案追加 | 2 | 工作风格 / 随笔生活，各追加 2 篇演示文章 |

生成和重写不使用缓存，每次点击都会产生真实的模型调用。

检查语义缓存与本地逻辑（不联网）：

```powershell
cd backend
npm install
npm run smoke
```

`smoke` 会强制清空 API Key，验证：缓存文件恰好 3 条且全部是语义条目；生成、重写、语义分析在无 Key 时抛出 `LLM_NOT_CONFIGURED`；提示词可复现；评分确定；重写降分保护接受 / 小幅下降仍采用 / 明显降分拒绝 / 平分四种情况。整个检查不联网。

缓存由 `npm run preheat` 从零重建。它不会调用网络，所以无 Key 也能执行；切换 `LLM_MODEL` 后需要重新执行，使缓存键与新模型一致：

```powershell
cd backend
npm run preheat
```

> 运行中的后端会把缓存读入内存。重建缓存前先停止后端，完成后再启动，避免旧缓存被写回文件。

---

## 五、技术栈

| 层 | 组件 |
| --- | --- |
| 前端 | Vue 3、Vite 6、Vue Router 4、Pinia 2、Element Plus 2、ECharts 5 |
| 后端 | Node.js 20+、Express 4、Prisma 6 |
| 数据库 | MySQL 8（utf8mb4） |
| 认证 | JWT + bcryptjs |
| 分词 | Node 内置 `Intl.Segmenter`，中文按词切分 |
| 运行方式 | 本地 Node.js + MySQL；Express 同端口托管构建后的前端 |
| 模型 | 任意 OpenAI Chat Completions 兼容接口 |

前端构建产物由 Express 直接托管，SPA 路由回退到 `index.html`；只有 `/api/*` 会进入 API 路由，未知 API 返回 JSON 404，不会误落到前端页面。

---

## 六、目录结构

```text
笔迹/
├── backend/
│   ├── .env.example                 # 后端环境变量模板
│   ├── data/llm_cache.json          # 3 条档案语义缓存（随仓库提交）
│   ├── scripts/smoke.js             # 不联网的逻辑检查
│   └── src/
│       ├── app.js                   # Express 入口、静态资源与 SPA 回退
│       ├── config.js                # 环境变量
│       ├── routes/                  # auth / profiles / generate / score / rewrite / meta / demo
│       ├── services/
│       │   ├── generate.js          # PLATFORMS 唯一来源 + 生成提示词
│       │   ├── style.js             # 本地统计与档案摘要
│       │   ├── score.js             # 通用 AI 味 + 个人偏差评分
│       │   ├── rewrite.js           # 按问题重写 + 降分保护
│       │   └── llm.js               # OpenAI 兼容调用 + 语义缓存（显式开启）
│       ├── demo/                    # 演示语料、语义档案、预置文案
│       └── prisma/                  # schema、迁移、种子、预热脚本
├── frontend/
│   ├── src/
│   │   ├── views/                   # 登录、档案列表/创建/详情、写作页
│   │   ├── components/              # 雷达图、档案卡、微调滑块、评分面板、对照面板
│   │   ├── stores/                  # Pinia 认证状态
│   │   └── api/                     # Axios 封装
│   └── vite.config.js               # 开发服务器与 /api 代理
├── docs/测试数据说明.md              # 测试记录
└── README.md
```

---

## 七、关键实现约束

### 平台知识只有一个来源

`backend/src/services/generate.js` 中的 `PLATFORMS` 定义平台名称、篇幅范围和写作指令。路由中没有任何 `if (platform === ...)` 分支；前端通过 `/api/meta` 读取平台元数据。

### 档案不可手改，但可追加

- 创建：`POST /api/profiles`，后端本地统计 + 一次语义分析，并保存原始语料；
- 查看：`GET /api/profiles/:id`；查看原文：`GET /api/profiles/:id/articles`；
- 追加：`POST /api/profiles/:id/append`，只接受新文章，后端会合并原有语料后重新分析；
- 重命名：`PATCH /api/profiles/:id`，只允许修改 `name`；
- `stats`、`semantic` 和原文不能通过编辑接口直接覆盖；直接提交会返回 `PROFILE_READONLY`；
- 删除：`DELETE /api/profiles/:id`，同时删除档案和保存的原文，只影响当前用户的数据。

### 微调关闭即完全不存在

前端在开关关闭时使用 `v-if` 不渲染滑块；后端在 `tuningEnabled !== true` 时既不下发 `tuning`，也不把微调段落拼进提示词。提示词因此不同：关闭微调和开启微调会产生两套独立的生成请求。

### 认证与归属

除注册、登录和健康检查外，所有 API 都经过认证中间件。档案、生成记录的查询、更新、删除都带 `where: { userId: req.userId }`。跨账号访问返回 404，避免泄露资源是否存在。

### 评分是确定性的

评分不依赖模型：`backend/src/services/score.js` 在本地计算句长分布、正式/口语比例、情绪词、比喻、个人经历、口头禅、高频词和通用 AI 套话，并给出句级问题定位。个人贴合需要档案；无档案时只做通用 AI 味检测。

---

## 八、API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | API、数据库、档案语义缓存与模型配置状态 |
| POST | `/api/auth/register` | 注册 |
| POST | `/api/auth/login` | 登录，返回 JWT |
| GET | `/api/auth/me` | 当前用户 |
| GET | `/api/profiles` | 当前用户档案列表 |
| POST | `/api/profiles` | 用 3–10 篇文章创建档案 |
| GET | `/api/profiles/:id` | 档案详情 |
| GET | `/api/profiles/:id/articles` | 查看档案已保存的原文 |
| POST | `/api/profiles/:id/append` | 追加 1–10 篇文章并重新分析 |
| PATCH | `/api/profiles/:id` | 仅重命名 |
| DELETE | `/api/profiles/:id` | 删除档案 |
| GET | `/api/meta` | 平台元数据 |
| GET | `/api/demo` | 演示账号、语料、写作设置 |
| POST | `/api/generate` | 三要素生成 |
| POST | `/api/score` | 检测与句级问题 |
| POST | `/api/rewrite` | 按问题重写 |

受保护接口使用请求头：

```http
Authorization: Bearer <token>
```

---

## 九、日常开发与维护

### 前端热更新

后端和前端各开一个终端：

```powershell
# 终端 1
cd backend
npm run dev
```

```powershell
# 终端 2
cd frontend
npm run dev
```

打开 **http://localhost:5173**。Vite 已把 `/api` 代理到 `http://localhost:3000`。修改前端后不需要手动构建；需要按生产模式检查时，再执行 `npm run build`，由后端的 3000 端口托管 `frontend/dist`。

### 重置演示数据

下面的命令会删除本地 `biji` 数据库中的数据并重新迁移，属于破坏性操作：

```powershell
cd backend
npx prisma migrate reset
npm run seed
```

### 重建档案语义缓存

执行：

```powershell
cd backend
npm run preheat
```

该命令会从零重建 3 条语义缓存，并清掉旧版本留下的生成 / 重写条目。

### 停止服务

在后端终端按 `Ctrl+C`。如果使用 `npm run dev`，同样按 `Ctrl+C` 停止监听进程。

---

## 十、已知限制与不在范围内

按项目定义，以下能力刻意不做：

- 不做第三方登录、邮箱验证、支付；
- 档案的统计与语义结果不可手改；可以追加文章、重命名或删除；
- 不做 Word / PDF 导出；
- 不训练或微调模型；
- 不发布到任何平台；
- 不生成配图；
- 不做移动端专门适配（桌面优先）；
- 不做多人协作、SSR、微服务拆分、CI 流水线；
- 不追求单元测试覆盖率，但提供不联网的 smoke 检查；交付前后端已通过临时 MySQL 完成真实 HTTP 端到端验证。

- **本机运行需要 Node.js 20+ 和 MySQL 8。** 换一台机器需要重新安装依赖、建库、迁移和初始化，不能只拷贝 `node_modules`。

---

## 十一、验收速查

| 验收项 | 操作 | 预期 |
| --- | --- | --- |
| 本地启动 | 按第一节完成建库、迁移、初始化并启动 | http://localhost:3000 可访问 |
| 健康检查 | `GET /api/health` | `db: ok`、`cache: ok`、`cacheEntries: 3`、`cacheScope: profile-semantic`；配置 Key 时 `llm: enabled` |
| 认证 | 错误密码登录 | 401，无 token |
| 跨账号隔离 | 两个账号互相访问对方档案 | 404，数据不可见 |
| 档案数量约束 | 提交 2 篇或 11 篇文章 | 400，提示 3–10 篇 |
| 档案只读 | PATCH 修改 stats/semantic | `PROFILE_READONLY` |
| 查看文章 | 打开档案详情 →「查看文章」 | 显示 4 篇原文、篇数和字数 |
| 追加文章 | 「继续投喂」→「填入演示追加」→ 更新 | 工作风格 / 随笔生活各从 4 篇变为 6 篇，分数与摘要重新计算 |
| 追加限制 | 每次超过 10 篇或更新后超过 20 篇 / 60000 字 | 400，提示具体上限 |
| 旧档案追加 | 对没有保存原文的旧档案追加 | 409，`PROFILE_NO_SOURCE`，提示新建档案 |
| 多档案 | 创建并切换档案生成 | 档案可独立选择 |
| 三平台不同 | 同一主题切三个平台 | 结构、篇幅、语气明显不同 |
| 重复生成 | 相同主题、档案、平台连续生成两次 | 两次正文不同，`llmCalls` 递增，`cacheEntries` 保持 3 |
| 档案差异 | 无档案 / 工作 / 生活 | 无档案通常最低；有档案的分数随模型输出变化，不承诺固定值 |
| 微调生效 | 开关前后各生成一次 | 正文不同，档案不变 |
| 句级定位 | 检测后点击下划线句 | 跳到对应问题卡片 |
| 重写保护 | 对一篇检测后的稿子重写 | 候选分比原稿低 5 分以内仍采用并显示新分数；低超过 5 分时保留原稿并提示“本轮改写未提升” |
| 重写上限 | 连续重写两轮 | 第 2 轮后按钮禁用；被拒绝的轮次也计入 |
| 无 Key 报错 | 不配置 Key 调用生成 / 重写 / 新建档案 | 503 `LLM_NOT_CONFIGURED`，页面提示配置 `backend/.env` |
| 演示账号 | `demo / demo1234` | 登录成功，含两份预置档案 |

---

## 十二、开源组件

Vue 3、Vite、Vue Router、Pinia、Element Plus、ECharts、Node.js、Express、Prisma、MySQL、jsonwebtoken、bcryptjs、Axios。各组件遵循其各自开源许可证；本仓库不包含任何需要商业授权的依赖。
