const path = require('node:path');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const {
  DEMO_ACCOUNT,
  WORK_ARTICLES,
  LIFE_ARTICLES,
  WORK_PROFILE,
  LIFE_PROFILE,
} = require('../demo/demoData');

const prisma = new PrismaClient();

function hashPassword(password) {
  return new Promise((resolve, reject) => {
    bcrypt.hash(password, 10, (error, hash) => (error ? reject(error) : resolve(hash)));
  });
}

async function main() {
  const passwordHash = await hashPassword(DEMO_ACCOUNT.password);

  const user = await prisma.user.upsert({
    where: { username: DEMO_ACCOUNT.username },
    update: { passwordHash },
    create: {
      username: DEMO_ACCOUNT.username,
      passwordHash,
    },
    select: { id: true, username: true },
  });

  const demoProfiles = [
    { profile: WORK_PROFILE, texts: WORK_ARTICLES },
    { profile: LIFE_PROFILE, texts: LIFE_ARTICLES },
  ];

  const profileCount = await prisma.profile.count({ where: { userId: user.id } });
  if (profileCount === 0) {
    await prisma.profile.createMany({
      data: demoProfiles.map(({ profile, texts }) => ({
        userId: user.id,
        name: profile.name,
        stats: profile.stats,
        semantic: profile.semantic,
        texts,
      })),
    });
    console.log(`已为演示账号创建 ${demoProfiles.length} 份笔迹档案。`);
  } else {
    // 旧版本档案没有保存原文。演示档案的原文是固定的，可以安全回填，
    // 让它们也能使用“继续投喂文章”功能。
    const existingProfiles = await prisma.profile.findMany({
      where: { userId: user.id },
      select: { id: true, name: true, texts: true },
    });
    let restored = 0;
    for (const { profile, texts } of demoProfiles) {
      const target = existingProfiles.find((item) => item.name === profile.name);
      const missingTexts =
        target && (!Array.isArray(target.texts) || target.texts.length === 0);
      if (!missingTexts) continue;
      await prisma.profile.update({
        where: { id: target.id },
        data: { texts },
      });
      restored += 1;
    }
    const backfillNote = restored
      ? `，并回填了 ${restored} 份演示档案的原始语料`
      : '';
    console.log(
      `演示账号已有 ${profileCount} 份档案，跳过档案初始化${backfillNote}。`
    );
  }

  console.log(`演示账号：${DEMO_ACCOUNT.username} / ${DEMO_ACCOUNT.password}`);
}

main()
  .catch((error) => {
    console.error('[seed] 初始化演示数据失败：', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
