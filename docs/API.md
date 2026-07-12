# FitLog API 接口文档 v1.1

> Base URL: `/api/v1`  
> Content-Type: `application/json`  
> Auth: Bearer Token (Access Token) 或 HttpOnly Cookie (Refresh Token)  
> 更新日期: 2026-06-06

---

## 通用说明

### 响应格式

所有接口统一返回格式：

```json
{
  "code": 200,
  "message": "success",
  "data": { ... },
  "error": null
}
```

错误响应：

```json
{
  "code": 400,
  "message": "Validation failed",
  "data": null,
  "error": "VALIDATION_ERROR"
}
```

### 认证机制

采用 JWT 双 Token 策略：

| Token | 位置 | 有效期 | 说明 |
|-------|------|--------|------|
| Access Token | `Authorization: Bearer <token>` | 15 分钟 | 每次请求携带 |
| Refresh Token | HttpOnly Cookie (`refreshToken`) | 30 天 | 仅 /auth/refresh 和 /auth/logout 使用 |

Access Token 过期时，前端 Axios 拦截器自动调用 `/auth/refresh` 获取新 Token。Refresh Token 采用轮换机制（rotation），每次刷新后旧 Token 立即吊销。

### 错误码列表

| HTTP Code | Error Code | 说明 |
|-----------|------------|------|
| 400 | `VALIDATION_ERROR` | 请求参数校验失败 |
| 400 | `NO_CODE_FOUND` | 未找到验证码 |
| 400 | `CODE_EXPIRED` | 验证码已过期 |
| 400 | `INVALID_CODE` | 验证码错误 |
| 400 | `MAX_ATTEMPTS` | 验证码尝试次数过多 |
| 400 | `CANNOT_DELETE_OFFICIAL` | 不能删除官方动作 |
| 401 | `UNAUTHORIZED` | 缺少认证信息 |
| 401 | `TOKEN_EXPIRED` | Access Token 已过期 |
| 401 | `INVALID_TOKEN` | Token 无效 |
| 401 | `INVALID_REFRESH_TOKEN` | Refresh Token 无效或过期 |
| 401 | `TOKEN_REVOKED` | Token 已被吊销 |
| 403 | `FORBIDDEN` | 无权限访问该资源 |
| 403 | `INVALID_EXERCISE_IDS` | 提交的 exerciseId 无效 |
| 404 | `NOT_FOUND` | 资源不存在 |
| 429 | `RATE_LIMIT_EXCEEDED` | 超出频率限制 |
| 429 | `EMAIL_RATE_LIMITED` | 邮箱发送频率过高 |
| 429 | `IP_RATE_LIMITED` | IP 请求频率过高 |
| 429 | `EXPORT_LIMITED` | 今日导出次数已达上限 |
| 500 | `INTERNAL_ERROR` | 服务器内部错误 |

---

## 1. 认证模块 `/auth`

### 1.1 发送验证码

```
POST /api/v1/auth/send-code
```

**Rate Limit**: 每邮箱 5次/小时，每IP 10次/小时

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": { "success": true }
}
```

**说明**: 开发模式下验证码打印在控制台，生产环境需接入邮件服务（Resend API）。

---

### 1.2 验证码登录（自动注册）

```
POST /api/v1/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "code": "123456"
}
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "user": { "id": "clx...", "email": "user@example.com" },
    "accessToken": "eyJ..."
  }
}
```

**Set-Cookie**: `refreshToken=...; HttpOnly; Path=/api/v1/auth; Max-Age=2592000; SameSite=Lax`

---

### 1.3 刷新 Token

```
POST /api/v1/auth/refresh
```

**Request**: Cookie 自动携带 `refreshToken`

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "accessToken": "eyJ..."
  }
}
```

---

### 1.4 退出登录

```
POST /api/v1/auth/logout
```

吊销当前 Refresh Token。

---

## 2. 动作库 `/exercises`

### 2.1 动作列表

```
GET /api/v1/exercises?page=1&limit=20&search=bench&muscle=chest&equipment=barbell
```

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| page | int | 1 | 页码 (≥1) |
| limit | int | 20 | 每页数量 (1-50) |
| search | string | - | 按名称模糊搜索 |
| muscle | string | - | 按目标肌群筛选 |
| equipment | string | - | 按器械类型筛选 |

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "data": [
      {
        "id": "0001",
        "name": "Barbell Bench Press",
        "targetMuscle": "chest",
        "equipment": "barbell",
        "mediaUrl": "/media/exercises/0001/0.jpg",
        "isOfficial": true,
        "createdById": null
      }
    ],
    "total": 873,
    "page": 1,
    "limit": 20
  }
}
```

---

### 2.2 筛选选项

```
GET /api/v1/exercises/options
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "muscles": ["abdominals", "biceps", "chest", ...],
    "equipment": ["barbell", "dumbbell", "body only", ...]
  }
}
```

---

### 2.3 动作详情

```
GET /api/v1/exercises/:id
```

**Response (200) — 官方动作:**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "0001",
    "name": "Barbell Bench Press",
    "targetMuscle": "chest",
    "equipment": "barbell",
    "mediaUrl": "/media/exercises/0001/0.jpg",
    "isOfficial": true,
    "instructions": [
      "Lie on a flat bench...",
      "Unrack the barbell...",
      "Lower the bar to your chest..."
    ],
    "level": "intermediate",
    "mechanic": "compound",
    "primaryMuscles": ["chest"],
    "secondaryMuscles": ["shoulders", "triceps"],
    "images": ["/media/exercises/0001/0.jpg", "/media/exercises/0001/1.jpg"]
  }
}
```

---

### 2.4 创建自定义动作

```
POST /api/v1/exercises
```

**Request Body:**
```json
{
  "name": "弹力带侧平举",
  "targetMuscle": "shoulders",
  "equipment": "bands",
  "notes": "慢速控制离心"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| name | string | ✅ | 动作名称 (≤100) |
| targetMuscle | string | ✅ | 目标肌群 (≤50) |
| equipment | string | ❌ | 器械类型 (≤50) |
| notes | string | ❌ | 备注 (≤500) |

---

### 2.5 删除自定义动作

```
DELETE /api/v1/exercises/:id
```

**说明**: 软删除（设置 deleted_at）。已关联训练集的记录仍保留。

---

## 3. 训练记录 `/workouts`

### 3.1 创建训练记录

```
POST /api/v1/workouts
```

**Request Body:**
```json
{
  "startTime": "2026-06-06T08:00:00.000Z",
  "endTime": "2026-06-06T09:15:00.000Z",
  "notes": "今天状态不错",
  "totalVolumeKg": 4500.5,
  "exercises": [
    {
      "exerciseId": "0001",
      "sortOrder": 1,
      "sets": [
        {
          "exerciseId": "0001",
          "sortOrder": 1,
          "setIndex": 1,
          "setType": "warmup",
          "weight": 60,
          "reps": 10,
          "rpe": 6,
          "completedAt": "2026-06-06T08:05:00.000Z",
          "actualRestTimeSec": 0,
          "isCompleted": true
        },
        {
          "exerciseId": "0001",
          "sortOrder": 1,
          "setIndex": 2,
          "setType": "standard",
          "weight": 100,
          "reps": 8,
          "rpe": 8.5,
          "completedAt": "2026-06-06T08:10:00.000Z",
          "actualRestTimeSec": 90,
          "isCompleted": true
        }
      ]
    }
  ]
}
```

**setType 枚举**: `warmup` | `standard` | `dropset` | `failure`

**Response (201)**: 返回包含所有 exerciseSets 的完整 WorkoutRecord 对象。

---

### 3.2 训练历史列表

```
GET /api/v1/workouts?page=1&limit=20
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "data": [
      {
        "id": "clx...",
        "startTime": "2026-06-06T08:00:00.000Z",
        "endTime": "2026-06-06T09:15:00.000Z",
        "notes": "今天状态不错",
        "totalVolumeKg": 4500.5,
        "createdAt": "2026-06-06T09:15:00.000Z",
        "_count": { "exerciseSets": 12 }
      }
    ],
    "total": 42,
    "page": 1,
    "limit": 20
  }
}
```

---

### 3.3 训练详情

```
GET /api/v1/workouts/:id
```

返回完整 WorkoutRecord 对象，包含所有 ExerciseSet（含 exercise 基本信息）。

---

### 3.4 更新训练记录 🆕

```
PUT /api/v1/workouts/:id
```

**Request Body:**
```json
{
  "notes": "更新后的备注",
  "endTime": "2026-06-06T09:30:00.000Z"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| notes | string | ❌ | 训练备注 (≤2000) |
| endTime | datetime | ❌ | 训练结束时间 |

**说明**: 为保护数据完整性，仅允许修改备注和结束时间。组次数据不可修改。

---

### 3.5 删除训练记录

```
DELETE /api/v1/workouts/:id
```

级联删除所有关联的 ExerciseSet。

---

## 4. 数据统计 `/stats`

### 4.1 训练过的动作列表

```
GET /api/v1/stats/exercises-used
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "id": "0001", "name": "Barbell Bench Press", "targetMuscle": "chest" }
  ]
}
```

---

### 4.2 动作统计（1RM趋势 + 组间休息）

```
GET /api/v1/stats/exercise/:id?days=90
```

| 参数 | 类型 | 默认值 | 可选值 |
|------|------|--------|--------|
| days | int | 90 | 30, 90, 180, 365 |

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "exerciseId": "0001",
    "days": 90,
    "oneRm": [
      { "date": "2026-05-01", "max1rm": 115.5 },
      { "date": "2026-05-08", "max1rm": 118.3 }
    ],
    "restTime": [
      { "date": "2026-05-01", "avgRestSec": 95 },
      { "date": "2026-05-08", "avgRestSec": 88 }
    ],
    "best1rm": 120.0,
    "totalWorkouts": 8,
    "totalSets": 32
  }
}
```

**1RM 计算公式 (Epley)**: `1RM = weight × (1 + reps / 30)` （仅 reps ≥ 2 参与计算）

---

## 5. 数据导出 `/export`

### 5.1 导出训练数据

```
GET /api/v1/export?format=json
GET /api/v1/export?format=csv
```

**Rate Limit**: 每用户每天 3 次

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| format | enum | json | `json` 或 `csv` |

**json 格式**: 按训练日期分组的完整 JSON  
**csv 格式**: 每行一个 ExerciseSet，字段: Date,Exercise,Muscle,Equipment,Set,Type,Weight(kg),Reps,RPE,Completed,Rest(s)

---

## 6. 收藏夹 `/favorites` 🆕

### 6.1 收藏列表

```
GET /api/v1/favorites
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "0001",
      "name": "Barbell Bench Press",
      "targetMuscle": "chest",
      "equipment": "barbell",
      "mediaUrl": "/media/exercises/0001/0.jpg",
      "isOfficial": true
    }
  ]
}
```

---

### 6.2 获取收藏 ID 列表

```
GET /api/v1/favorites/ids
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": ["0001", "0042", "0100"]
}
```

用于前端快速判断某动作是否已收藏。

---

### 6.3 添加收藏

```
POST /api/v1/favorites/:exerciseId
```

幂等操作（重复添加不报错）。

---

### 6.4 取消收藏

```
DELETE /api/v1/favorites/:exerciseId
```

幂等操作。

---

## 7. 训练模板 `/templates` 🆕

### 7.1 模板列表

```
GET /api/v1/templates
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    {
      "id": "clx...",
      "name": "推拉腿 Day 1",
      "notes": "以复合动作为主",
      "createdAt": "2026-06-06T10:00:00.000Z",
      "updatedAt": "2026-06-06T10:00:00.000Z",
      "_count": { "exercises": 5 }
    }
  ]
}
```

---

### 7.2 模板详情

```
GET /api/v1/templates/:id
```

返回完整模板对象，含所有 TemplateExercise（含 exercise 名）。

---

### 7.3 创建模板

```
POST /api/v1/templates
```

**Request Body:**
```json
{
  "name": "推拉腿 Day 1",
  "notes": "以复合动作为主",
  "exercises": [
    {
      "exerciseId": "0001",
      "sortOrder": 1,
      "targetSets": 3,
      "targetReps": 8,
      "targetWeight": 100,
      "notes": "注意离心控制"
    }
  ]
}
```

---

### 7.4 从模板加载训练数据

```
GET /api/v1/templates/:id/workout
```

返回可直接填充到训练记录表单的数据结构（含预设组次）。

---

### 7.5 删除模板

```
DELETE /api/v1/templates/:id
```

---

## 8. 用户中心 `/user` 🆕

### 8.1 获取个人资料

```
GET /api/v1/user/profile
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "id": "clx...",
    "email": "user@example.com",
    "nickname": "健身达人",
    "avatarUrl": null,
    "createdAt": "2026-05-31T00:00:00.000Z",
    "stats": {
      "totalWorkouts": 42,
      "totalFavorites": 15,
      "totalCustomExercises": 3
    }
  }
}
```

---

### 8.2 更新个人资料

```
PUT /api/v1/user/profile
```

**Request Body:**
```json
{
  "nickname": "健身达人",
  "avatarUrl": null
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| nickname | string | ❌ | 昵称 (1-50) |
| avatarUrl | string | ❌ | 头像URL (≤255) |

---

## 9. 身体数据 `/measurements` 🆕

### 9.1 身体数据列表

```
GET /api/v1/measurements?page=1&limit=20
```

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": {
    "data": [
      {
        "id": "clx...",
        "date": "2026-06-06T08:00:00.000Z",
        "weightKg": 75.5,
        "bodyFatPct": 15.2,
        "chestCm": 102,
        "waistCm": 80,
        "hipCm": 95,
        "armCm": 37,
        "thighCm": 58,
        "notes": "减脂期第三周",
        "createdAt": "2026-06-06T08:00:00.000Z"
      }
    ],
    "total": 10,
    "page": 1,
    "limit": 20
  }
}
```

---

### 9.2 记录身体数据

```
POST /api/v1/measurements
```

**Request Body:**
```json
{
  "date": "2026-06-06T08:00:00.000Z",
  "weightKg": 75.5,
  "bodyFatPct": 15.2,
  "chestCm": 102,
  "waistCm": 80,
  "hipCm": 95,
  "armCm": 37,
  "thighCm": 58,
  "notes": "减脂期第三周"
}
```

所有数值字段可选（至少填写一项）。

---

### 9.3 体重趋势

```
GET /api/v1/measurements/trend?days=90
```

| 参数 | 类型 | 默认值 | 可选值 |
|------|------|--------|--------|
| days | int | 90 | 30, 90, 180, 365 |

**Response (200):**
```json
{
  "code": 200,
  "message": "success",
  "data": [
    { "date": "2026-05-01", "weight": 78.0 },
    { "date": "2026-05-08", "weight": 77.2 }
  ]
}
```

---

### 9.4 删除身体数据

```
DELETE /api/v1/measurements/:id
```

---

## 10. 健康检查

```
GET /api/v1/health
```

**Response (200):**
```json
{
  "status": "ok",
  "timestamp": "2026-06-06T12:00:00.000Z"
}
```

---

## 11. 静态资源

```
GET /media/exercises/:path
```

静态文件服务（Cache-Control: max-age=2592000, immutable），用于动作图片。

---

## 附录 A: 数据库表结构

| 表名 | 说明 | 行数预估 |
|------|------|----------|
| users | 用户表 | N (用户数) |
| refresh_tokens | Refresh Token | ~N |
| exercises | 动作库 | 873 (官方) + N (自定义) |
| workout_records | 训练记录 | ~N (每次训练一条) |
| exercise_sets | 训练组次 | ~10N (每训练约10组) |
| favorite_exercises | 🆕 收藏夹 | ~N |
| workout_templates | 🆕 训练模板 | ~N |
| workout_template_exercises | 🆕 模板动作 | ~5N (每模板约5动作) |
| body_measurements | 🆕 身体数据 | ~N |

## 附录 B: 数据模型关系

```
User 1──N WorkoutRecord 1──N ExerciseSet N──1 Exercise
User 1──N Exercise (custom)
User 1──N RefreshToken
User 1──N FavoriteExercise N──1 Exercise   🆕
User 1──N WorkoutTemplate 1──N WorkoutTemplateExercise N──1 Exercise  🆕
User 1──N BodyMeasurement  🆕
```
