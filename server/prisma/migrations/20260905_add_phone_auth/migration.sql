-- Phase 2.1 Migration: Add phone and phoneVerifiedAt to User, make email nullable
-- Safe migration: No tables dropped, no columns dropped, no data deleted, User.id preserved

-- 1. 扩展 User 表结构
ALTER TABLE `User`
  ADD COLUMN `phone` VARCHAR(20) NULL,
  ADD COLUMN `phoneVerifiedAt` DATETIME(3) NULL,
  MODIFY `email` VARCHAR(100) NULL;

-- 2. 为 phone 建立唯一索引
CREATE UNIQUE INDEX `User_phone_key` ON `User`(`phone`);
