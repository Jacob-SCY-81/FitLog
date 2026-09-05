-- Align schema with production models (Phase 3-12 features)

-- 1. 补齐 User 表基础字段
ALTER TABLE `User`
  ADD COLUMN `passwordHash` VARCHAR(255) NULL,
  ADD COLUMN `nickname` VARCHAR(50) NULL,
  ADD COLUMN `avatarUrl` VARCHAR(255) NULL;

-- 2. 补齐 Exercise 表 notes 字段
ALTER TABLE `Exercise`
  ADD COLUMN `notes` VARCHAR(500) NULL;

-- 3. 创建 BodyMeasurement 身体数据表
CREATE TABLE IF NOT EXISTS `BodyMeasurement` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `weightKg` DOUBLE NULL,
    `bodyFatPct` DOUBLE NULL,
    `chestCm` DOUBLE NULL,
    `waistCm` DOUBLE NULL,
    `hipCm` DOUBLE NULL,
    `armCm` DOUBLE NULL,
    `thighCm` DOUBLE NULL,
    `notes` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `BodyMeasurement_userId_date_idx`(`userId`, `date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 4. 添加外键关联
ALTER TABLE `BodyMeasurement` ADD CONSTRAINT `BodyMeasurement_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
