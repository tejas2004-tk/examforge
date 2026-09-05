-- AlterTable: account lockout state, password rotation tracking and user preferences.
ALTER TABLE `User`
    ADD COLUMN `lastPasswordChangeAt` DATETIME(3) NULL,
    ADD COLUMN `failedLoginCount` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lockedUntil` DATETIME(3) NULL,
    ADD COLUMN `preferences` JSON NULL;

-- AlterTable: refresh-token families, reuse detection and device attribution.
ALTER TABLE `RefreshToken`
    ADD COLUMN `familyId` VARCHAR(191) NOT NULL DEFAULT '',
    ADD COLUMN `replacedById` VARCHAR(191) NULL,
    ADD COLUMN `ipAddress` VARCHAR(191) NULL,
    ADD COLUMN `userAgent` TEXT NULL,
    ADD COLUMN `device` VARCHAR(191) NULL,
    ADD COLUMN `lastUsedAt` DATETIME(3) NULL,
    ADD COLUMN `revokedReason` VARCHAR(191) NULL;

-- Existing rows predate families; each becomes its own single-member family.
UPDATE `RefreshToken` SET `familyId` = `id` WHERE `familyId` = '';

ALTER TABLE `RefreshToken` ALTER COLUMN `familyId` DROP DEFAULT;

CREATE INDEX `RefreshToken_familyId_idx` ON `RefreshToken`(`familyId`);

-- AlterTable: record why a sign-in failed so lockout decisions are auditable.
ALTER TABLE `LoginHistory`
    ADD COLUMN `reason` VARCHAR(191) NULL,
    MODIFY COLUMN `userAgent` TEXT NULL;

CREATE INDEX `LoginHistory_userId_createdAt_idx` ON `LoginHistory`(`userId`, `createdAt`);

-- CreateIndex: analytics reads filter attempts by status over a date range.
CREATE INDEX `Attempt_status_submittedAt_idx` ON `Attempt`(`status`, `submittedAt`);

-- CreateIndex: teacher-scoped test lists and analytics filter on the owner.
CREATE INDEX `Test_createdById_idx` ON `Test`(`createdById`);
