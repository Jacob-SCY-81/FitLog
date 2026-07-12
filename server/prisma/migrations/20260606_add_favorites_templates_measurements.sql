-- Migration: add_favorites_templates_measurements
-- Date: 2026-06-06
-- Description: Add FavoriteExercise, WorkoutTemplate, WorkoutTemplateExercise, BodyMeasurement tables
--              Add nickname/avatarUrl to User table

-- Add user profile fields
ALTER TABLE `users` ADD COLUMN `nickname` VARCHAR(50) NULL AFTER `email`;
ALTER TABLE `users` ADD COLUMN `avatar_url` VARCHAR(255) NULL AFTER `nickname`;

-- Favorite exercises (user bookmarks)
CREATE TABLE `favorite_exercises` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `exercise_id` VARCHAR(191) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `favorite_exercises_user_id_exercise_id_key` (`user_id`, `exercise_id`),
  INDEX `favorite_exercises_user_id_idx` (`user_id`),
  CONSTRAINT `favorite_exercises_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `favorite_exercises_exercise_id_fkey` FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Workout templates (reusable training plans)
CREATE TABLE `workout_templates` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `notes` TEXT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `workout_templates_user_id_idx` (`user_id`),
  CONSTRAINT `workout_templates_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Template exercises
CREATE TABLE `workout_template_exercises` (
  `id` VARCHAR(191) NOT NULL,
  `template_id` VARCHAR(191) NOT NULL,
  `exercise_id` VARCHAR(191) NOT NULL,
  `sort_order` INT NOT NULL,
  `target_sets` INT NOT NULL DEFAULT 3,
  `target_reps` INT NOT NULL DEFAULT 10,
  `target_weight` DOUBLE NOT NULL DEFAULT 0,
  `notes` VARCHAR(200) NULL,
  PRIMARY KEY (`id`),
  INDEX `workout_template_exercises_template_id_idx` (`template_id`),
  CONSTRAINT `workout_template_exercises_template_id_fkey` FOREIGN KEY (`template_id`) REFERENCES `workout_templates`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `workout_template_exercises_exercise_id_fkey` FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Body measurements
CREATE TABLE `body_measurements` (
  `id` VARCHAR(191) NOT NULL,
  `user_id` VARCHAR(191) NOT NULL,
  `date` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `weight_kg` DOUBLE NULL,
  `body_fat_pct` DOUBLE NULL,
  `chest_cm` DOUBLE NULL,
  `waist_cm` DOUBLE NULL,
  `hip_cm` DOUBLE NULL,
  `arm_cm` DOUBLE NULL,
  `thigh_cm` DOUBLE NULL,
  `notes` VARCHAR(500) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  INDEX `body_measurements_user_id_date_idx` (`user_id`, `date`),
  CONSTRAINT `body_measurements_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
