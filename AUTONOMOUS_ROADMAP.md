# FitLog Autonomous Development Roadmap

> Project: FitLog
> Mode: Autonomous Development
> Last Updated: 2026-09-05

---

# 0. Ultimate Goal

将 FitLog 构建成为一个：

* 可真实使用
* 移动端友好
* 数据可靠
* 认证安全
* 可扩展
* 可测试
* 可部署
* 可维护

的生产级 Web 健身训练记录系统。

---

# Phase 1 — Foundation

## Status

COMPLETED

目标：

* 基础项目结构
* 前后端架构
* 数据库
* 基础认证
* 基础 UI
* 基础训练记录

---

# Phase 2 — Authentication & Security

## Status

COMPLETED / VERIFY CONTINUOUSLY

目标：

* Email login
* Phone login
* Verification Code
* Session
* Refresh Token
* Rate Limit
* Anti abuse
* Security validation

---

# Phase 2.5 — Infrastructure Hardening

## 2.5A

Status:

COMPLETED

内容：

* Redis architecture
* Verification Store architecture
* Distributed Rate Limiter architecture

---

## 2.5B-1

Status:

COMPLETED

内容：

* Redis client
* Redis verification code store
* Atomic Lua verification
* Distributed rate limiter
* Fail-Closed
* Concurrent verification protection

已有验证：

* 39/39 targeted tests PASS
* Phase 2.1 regression PASS
* Phase 2.2 regression PASS
* Playwright phone-auth E2E PASS
* Build PASS
* Prisma validation PASS
* git diff --check PASS

注意：

模拟 Redis 测试 PASS ≠ 真实生产 Redis PASS。

---

# Phase 2.5B-2 — Production SMS Driver

## Status

NEXT

目标：

建立真实 SMS Provider 抽象层。

要求：

* Provider interface
* Provider adapter
* Development mock provider
* Production provider
* timeout
* retry policy
* idempotency
* error mapping
* logging
* rate limiting integration
* security review

测试：

* Unit
* Integration
* Failure
* Timeout
* Retry
* E2E where possible

不得真实大量发送短信。

---

# Phase 2.5B-3 — Email Provider Hardening

目标：

* Email provider abstraction
* production adapter
* timeout
* retry
* template
* verification integration
* error handling

---

# Phase 2.5B-4 — Authentication Security Audit

全面检查：

* brute force
* session fixation
* token replay
* refresh token rotation
* logout
* verification code replay
* enumeration
* rate limit
* IP abuse
* device/session management

补充测试。

---

# Phase 3 — Core Training System

目标：

完成 FitLog 核心健身业务。

包括：

* Exercise Library
* Exercise CRUD
* Training Templates
* Start Training
* Dynamic Sets
* Weight
* Reps
* RPE
* Rest Timer
* Training Record
* Training History
* Training Detail
* Edit Record
* Delete Record
* Resume / Exit Training

所有核心流程必须具备：

* API
* UI
* validation
* error handling
* tests
* E2E

---

# Phase 3.5 — Training Analytics

目标：

建立训练数据统计系统。

包括：

* volume
* sets
* reps
* weight progression
* exercise progression
* training frequency
* rest time
* training duration
* historical comparison
* trend charts

---

# Phase 4 — Exercise Media

目标：

完善动作库媒体体验。

包括：

* exercise images
* exercise videos
* mobile preview
* loading
* fallback
* media validation

---

# Phase 5 — Body Measurements

包括：

* body weight
* body measurements
* history
* trends
* charts

---

# Phase 6 — Favorites & Templates

包括：

* favorite exercises
* training templates
* duplicate template
* edit template
* delete template
* start workout from template

---

# Phase 7 — Mobile UX

重点：

FitLog 的核心使用场景是：

手机浏览器训练过程中快速记录。

优化：

* touch interaction
* large controls
* minimal typing
* quick set entry
* timer visibility
* offline tolerance where appropriate
* responsive layout
* PWA

必须使用真实移动 viewport 做 E2E。

---

# Phase 8 — Reliability

检查：

* API timeout
* DB failure
* Redis failure
* external provider failure
* concurrent requests
* retry
* idempotency
* error handling
* logging

---

# Phase 9 — Performance

检查：

* database queries
* N+1
* indexes
* API latency
* frontend bundle
* image optimization
* caching
* Redis usage

只进行有实际收益的优化。

---

# Phase 10 — Observability

增加：

* structured logging
* request ID
* error tracking abstraction
* health endpoint
* readiness
* liveness
* Redis health
* DB health

禁止日志泄露：

* password
* token
* verification code
* full phone
* sensitive credentials

---

# Phase 11 — Production Deployment

目标环境：

Linux

准备：

* Docker
* Docker Compose
* Node
* MySQL
* Redis
* environment variables
* reverse proxy
* HTTPS
* migration
* backup
* restore
* health checks

---

# Phase 12 — Production Readiness Audit

最终执行：

## Security

* Authentication
* Authorization
* Input validation
* Rate limit
* Secrets
* CORS
* CSRF where applicable
* XSS
* SQL injection
* SSRF where applicable

## Data

* migration
* backup
* restore
* consistency

## Infrastructure

* Redis
* MySQL
* SMS
* Email

## Application

* API
* Frontend
* Mobile UX
* PWA

## Testing

* Unit
* Integration
* E2E
* Regression
* Failure testing

## Deployment

* Linux
* Docker
* HTTPS
* Environment variables

---

# Autonomous Rule

每个 Phase 完成后：

不要询问用户。

重新扫描项目。

检查本 Roadmap。

自动选择下一个未完成且最高优先级任务。

继续执行。

只有触发 AGENT_RULES.md 中定义的人工确认条件时才暂停。
