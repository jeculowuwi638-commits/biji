-- CreateTable
CREATE TABLE `NovelProject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `title` VARCHAR(120) NOT NULL,
    `description` TEXT NULL,
    `styleProfileId` INTEGER NULL,
    `narrator` VARCHAR(32) NOT NULL DEFAULT 'third-limited',
    `strictSettings` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NovelProject_userId_idx`(`userId`),
    INDEX `NovelProject_styleProfileId_idx`(`styleProfileId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `NovelChapter` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `novelId` INTEGER NOT NULL,
    `order` INTEGER NOT NULL,
    `title` VARCHAR(160) NOT NULL,
    `content` LONGTEXT NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `NovelChapter_userId_idx`(`userId`),
    INDEX `NovelChapter_novelId_idx`(`novelId`),
    UNIQUE INDEX `NovelChapter_novelId_order_key`(`novelId`, `order`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StoryBible` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `novelId` INTEGER NOT NULL,
    `core` JSON NOT NULL,
    `corrections` JSON NULL,
    `sourceChapters` INTEGER NOT NULL DEFAULT 0,
    `analyzedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StoryBible_userId_idx`(`userId`),
    UNIQUE INDEX `StoryBible_novelId_key`(`novelId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `NovelProject` ADD CONSTRAINT `NovelProject_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NovelProject` ADD CONSTRAINT `NovelProject_styleProfileId_fkey` FOREIGN KEY (`styleProfileId`) REFERENCES `Profile`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NovelChapter` ADD CONSTRAINT `NovelChapter_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `NovelChapter` ADD CONSTRAINT `NovelChapter_novelId_fkey` FOREIGN KEY (`novelId`) REFERENCES `NovelProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryBible` ADD CONSTRAINT `StoryBible_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StoryBible` ADD CONSTRAINT `StoryBible_novelId_fkey` FOREIGN KEY (`novelId`) REFERENCES `NovelProject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
