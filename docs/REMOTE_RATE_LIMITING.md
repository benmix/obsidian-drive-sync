# Remote Rate Limiting Architecture

## Context

`RateLimitedRemoteFileSystem` 仍然需要保留，但应满足两个约束：

- 限流能力由 provider 内聚，不由 runtime/settings 控制。
- 新增 remote provider 时可复用同一策略实现，避免复制粘贴。

## Decision

采用 **Provider 侧可插拔策略链**：

1. 在 provider 层定义统一策略接口  
   `RemoteFileSystemStrategy` + `applyRemoteFileSystemStrategies`

2. 将限流实现迁到 provider 可复用策略目录  
   `src/provider/strategy/rate-limited-remote-file-system-strategy.ts`

3. 由 remote provider 在 `createRemoteFileSystem` 内部组装策略链  
   `proton-drive` 默认启用限流策略

4. 删除外部配置项  
   不再暴露 `enableRateLimitedRemoteFileSystem` settings toggle  
   runtime 不再注入或包裹限流适配器

## Why This Design

- 职责边界清晰：`sync/runtime` 只消费 `RemoteFileSystem` 抽象，不理解 provider 细节。
- 复用路径稳定：任意新 provider 只需导入策略工厂即可复用限流逻辑。
- 避免配置漂移：不会出现“provider 需要限流，但用户开关误关导致不稳定”的情况。

## Implemented Changes

- 新增 provider 策略抽象：
    - `src/provider/strategy/contracts.ts`
- 新增共享限流策略：
    - `src/provider/strategy/rate-limited-remote-file-system-strategy.ts`
- 远端 provider 实现内部组合策略链：
    - `src/provider/providers/proton-drive/provider.ts`
- runtime 去除限流注入：
    - `src/runtime/sync-coordinator.ts`
- settings/main 去除 `enableRateLimitedRemoteFileSystem`：
    - `src/settings.ts`
    - `src/main.ts`
- 移除旧 sync adapter 实现：
    - `src/sync/adapters/remote/rate-limited-remote-file-system.ts`

## Reuse Guide for New Remote Providers

在新的 provider 中复用策略，最小步骤：

1. 创建基础 `RemoteFileSystem` 实现（provider 专有 SDK 适配）
2. 引入 `applyRemoteFileSystemStrategies`
3. 组合已有策略（例如 `createRateLimitedRemoteFileSystemStrategy()`）
4. 在 `createRemoteFileSystem(client, scopeId)` 中返回组合后的实例

这样可以保持 provider 内聚，同时共享通用策略能力。
