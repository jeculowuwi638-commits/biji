# 笔迹 · 你的个人 AI 写作分身

> 让 AI 学会你的表达方式。

笔迹不是又一个“输入题目、输出文章”的生成器。它先从你过去写过的 3–10 篇文章里提取一份**不可手改、可继续投喂的写作档案**，再带着这份档案写作，最后检测这篇稿子“像不像你”，并按具体问题重写。

---

## 一、本机启动（Node.js + MySQL）

项目按**本地 Node.js + MySQL** 运行。首次启动需要创建数据库、配置一次 `backend/.env`，之后直接启动后端即可；不配置 API Key 也能使用演示缓存。

> 下文命令默认在项目根目录（包含 `backend/`、`frontend/` 的目录）执行。

### 下载后首次启动

从 Gitee 克隆到本地：

```powershell
git clone https://gitee.com/p-jiaxin11111/biji.git
cd biji
```

然后依次完成下面 1–4 步：

1. 创建 MySQL 数据库和账号（只需一次）；
2. 复制 `backend/.env.example` 为 `backend/.env`，按需填写自己的 API Key；
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

同一个文件里还有 `PORT`、`JWT_SECRET` 和大模型配置。没有 API Key 时保持 `LLM_API_KEY=` 为空即可，演示会走内置缓存。

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

后端启动日志会显示当前端口、模型状态和缓存条目数。也可以访问 `http://localhost:3000/api/health` 检查 API、数据库和缓存状态。

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
| 重写时提示 `DEMO_NO_CACHE` | 无 Key 时只有预置路径可离线重写，按提示点击“载入演示设置” |

---

## 二、无 Key 演示脚本（建议按顺序验收）

### 1. 登录与预置档案

使用 `demo / demo1234` 登录后进入「笔迹档案」。演示账号已经有两份可继续投喂的档案：

- **工作风格**：正式、偏书面、句子较长，关注流程与协作。
- **随笔生活**：口语、短句、个人经历多，情绪和比喻更明显。

在「新建档案」页点击「用演示语料试一份」，可以再创建一份 **观点评论** 档案；分析请求同样命中内置缓存。

### 2. 生成、检测、重写闭环

进入「开始写作」，点击右上角或空状态里的 **「载入演示设置」**。它会自动填入：

- 主题：把下班后的两个小时留给写作，也拒绝几场不想去的饭局；
- 平台：公众号；
- 档案：随笔生活；
- 微调：关闭（滑块保留 25 / 60 / 35 / 60 的演示值，打开开关即可复用）。

点击 **「生成这一篇」**，应立刻返回并显示「演示缓存」（约 820 字）。然后点击 **「检测像不像你」**：

| 阶段 | 预期结果 |
| --- | --- |
| 首次检测 | **76 分**，有几分像；AI 味 14，个人贴合 79；4 个问题 |
| 第 1 轮「按问题重写并复检」 | **97 分**，很像你；AI 味 0，个人贴合 95；仅剩 1 个低严重度问题 |
| 第 2 轮重写并复检 | **100 分**，很像你；AI 味 0，个人贴合 100；0 个问题，达到 2 轮上限 |
| 重写后 | 出现左右对照面板，可比较重写前后正文与分数 |

正文中带下划线的句子就是问题定位，点击可跳到右侧对应的问题说明。

> 无 Key 时，重写只预置了「公众号 / 随笔生活 / 微调关闭」连续两轮。其他路径会明确提示 `DEMO_NO_CACHE`，并给出“载入演示设置”的按钮，不会静默失败。

### 3. 三平台确实不同

保持演示主题和「随笔生活」档案，依次切换平台并生成：

| 平台 | 篇幅目标 | 演示文案 |
| --- | --- | --- |
| 公众号 | 800–1500 字 | 约 820 字，完整叙事 |
| 小红书 | 300–500 字 | 约 310 字，短段落 + emoji + 话题标签 |
| 抖音脚本 | 350–600 字 | 约 350 字，分镜画面提示 + 口播 |

三份结果在结构、语气和段落节奏上明显不同。

### 4. 档案差异与普通 AI 对照组

仍使用公众号和演示主题，只切换「用哪份笔迹」：

| 档案 | 检测分数 | 说明 |
| --- | --- | --- |
| 不使用档案 | 53 分 | 普通 AI 对照组，只计算通用 AI 味 |
| 工作风格 | 95 分 | 正式、流程化表达与档案吻合 |
| 随笔生活 | 76 分 | 口语和生活细节接近，但仍有几处偏差 |

“不使用档案”时，检测面板不显示个人贴合度，只显示通用 AI 味问题。

### 5. 微调开关

重新载入演示设置后，打开「要不要微调」：

- 关闭时：滑块不渲染，也不会写入提示词；
- 打开时：四个滑块出现，值仍是演示值；
- 再次生成会命中预置的**微调版**缓存（约 810 字），可与关闭微调的版本直接对比；
- 微调只影响本次生成，不会改动档案。

### 6. 档案的创建、查看、追加、重命名与删除

- 新建档案必须提供 **3–10 篇**文章，每篇至少 20 字；
- 档案的统计结果和语义摘要不能手动编辑，详情页没有“编辑内容”入口；
- 详情页的 **「查看文章」** 可以查看已经投喂的全部原文；
- 详情页的 **「继续投喂」** 可以一次追加 **1–10 篇**新文章，系统会把新文章与已保存原文合并，重新计算统计层和语义层；
- 追加后档案最多保存 **20 篇 / 60000 字**；更新结果会立即用于后续生成和检测；
- 无 Key 时，演示账号可以点击追加弹窗里的 **「填入演示追加」**，用预置的追加语料离线体验完整更新流程；自定义文章需要配置 `LLM_API_KEY`；
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
| 2:10–3:00 | 检测：指出下划线句 → 按问题重写 → 看完 76 → 97 → 100 的闭环 |

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

- 新请求先查本地缓存；命中仍即时返回；
- 未命中才会调用真实模型，并按 `model|temperature|system|user` 的 MD5 写入缓存；
- 档案语义分析、生成、重写都会走真实模型；
- 检测和评分仍然是本地规则计算，不消耗模型调用。

`deepseek-v4-flash` 是 DeepSeek-V4.1-Flash 的兼容别名；官方当前模型名是 `deepseek-flash`，两者可互换。若账户提示模型不存在，把 `LLM_MODEL` 改成 `deepseek-flash` 即可。

DeepSeek V4 默认开启思考模式。写作和档案分析不需要推理过程，`LLM_THINKING=disabled` 会关闭它，显著降低延迟和费用；换成其他兼容服务时留空即可。

也可以把 `LLM_BASE_URL` / `LLM_MODEL` 换成任何兼容 OpenAI Chat Completions 的服务。

---

## 四、演示缓存

- 文件：`backend/data/llm_cache.json`
- 键：`md5(model|temperature|system|user)`
- 当前预置 **15 条**：

| 类型 | 数量 | 覆盖路径 |
| --- | --- | --- |
| 档案语义分析 | 1 | 演示语料「观点评论」 |
| 档案追加 | 2 | 工作风格 / 随笔生活，各追加 2 篇演示文章 |
| 生成 | 9 | 3 个平台 ×（无档案 / 工作风格 / 随笔生活） |
| 生成（微调开启） | 1 | 公众号 / 随笔生活 |
| 重写 | 2 | 公众号 / 随笔生活 / 微调关闭，连续两轮 |

检查缓存与离线闭环：

```powershell
cd backend
npm install
npm run smoke
```

`smoke` 会强制清空 API Key，逐条验证缓存命中、评分确定性、句级问题、重写结果与平台篇幅。缓存与评分已在 Node 20 和 Node 24 下分别验证，结果一致。

缓存由 `npm run preheat` 生成。为了让预热和运行时使用的键完全一致，档案统计使用冻结的种子数据，语义分析提示词不包含运行时统计。

如果想恢复仓库自带的 15 条演示缓存，删除 `backend/data/llm_cache.json` 后执行：

```powershell
cd backend
npm run preheat
```

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
│   ├── data/llm_cache.json          # 预置演示缓存（随仓库提交）
│   ├── scripts/smoke.js             # 离线全流程检查
│   └── src/
│       ├── app.js                   # Express 入口、静态资源与 SPA 回退
│       ├── config.js                # 环境变量
│       ├── routes/                  # auth / profiles / generate / score / rewrite / meta / demo
│       ├── services/
│       │   ├── generate.js          # PLATFORMS 唯一来源 + 生成提示词
│       │   ├── style.js             # 本地统计与档案摘要
│       │   ├── score.js             # 通用 AI 味 + 个人偏差评分
│       │   ├── rewrite.js           # 按问题重写提示词
│       │   └── llm.js               # OpenAI 兼容调用 + 文件缓存
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

前端在开关关闭时使用 `v-if` 不渲染滑块；后端在 `tuningEnabled !== true` 时既不下发 `tuning`，也不把微调段落拼进提示词。缓存键也因此不同：关闭微调和开启微调是两条独立结果。

### 认证与归属

除注册、登录和健康检查外，所有 API 都经过认证中间件。档案、生成记录的查询、更新、删除都带 `where: { userId: req.userId }`。跨账号访问返回 404，避免泄露资源是否存在。

### 评分是确定性的

评分不依赖模型：`backend/src/services/score.js` 在本地计算句长分布、正式/口语比例、情绪词、比喻、个人经历、口头禅、高频词和通用 AI 套话，并给出句级问题定位。个人贴合需要档案；无档案时只做通用 AI 味检测。

---

## 八、API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | API、数据库、缓存与模型配置状态 |
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

### 恢复演示缓存

删除 `backend/data/llm_cache.json`，再执行：

```powershell
cd backend
npm run preheat
```

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
- 不追求单元测试覆盖率，但提供离线 smoke 检查；交付前后端已通过临时 MySQL 完成真实 HTTP 端到端验证。

- **本机运行需要 Node.js 20+ 和 MySQL 8。** 换一台机器需要重新安装依赖、建库、迁移和初始化，不能只拷贝 `node_modules`。

---

## 十一、验收速查

| 验收项 | 操作 | 预期 |
| --- | --- | --- |
| 本地启动 | 按第一节完成建库、迁移、初始化并启动 | http://localhost:3000 可访问 |
| 健康检查 | `GET /api/health` | `db: ok`、`cache: ok`、`cacheEntries: 15`，无 Key 时 `llm: disabled` |
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
| 档案差异 | 无档案 / 工作 / 生活 | 53 / 95 / 76 分 |
| 微调生效 | 开关前后各生成一次 | 正文不同，档案不变 |
| 句级定位 | 检测后点击下划线句 | 跳到对应问题卡片 |
| 重写闭环 | 检测 76 → 连续两轮重写 → 自动复检 | 第 1 轮 97 分（剩 1 个低严重度问题），第 2 轮 100 分（0 问题） |
| 无 Key 演示 | 不配置 Key 完成上述流程 | 全部命中缓存，明确提示 `DEMO_NO_CACHE` 边界 |
| 演示账号 | `demo / demo1234` | 登录成功，含两份预置档案 |

---

## 十二、开源组件

Vue 3、Vite、Vue Router、Pinia、Element Plus、ECharts、Node.js、Express、Prisma、MySQL、jsonwebtoken、bcryptjs、Axios。各组件遵循其各自开源许可证；本仓库不包含任何需要商业授权的依赖。
