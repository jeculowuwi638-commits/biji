-- 保存档案的原始语料，用于后续追加文章时重新合并分析。
-- 旧档案没有原文，texts 为 NULL；演示档案会由 seed 脚本回填。
ALTER TABLE `Profile` ADD COLUMN `texts` JSON NULL;
