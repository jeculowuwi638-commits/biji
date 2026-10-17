-- 笔迹：本机 MySQL 初始化
-- 用法（在项目根目录执行）：
-- & "C:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe" -u root -p -e "source backend/scripts/init-db.sql"

CREATE DATABASE IF NOT EXISTS biji
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'biji'@'localhost' IDENTIFIED BY 'biji_password';
CREATE USER IF NOT EXISTS 'biji'@'127.0.0.1' IDENTIFIED BY 'biji_password';

-- 如果用户已经存在，确保密码与 backend/.env 一致。
ALTER USER 'biji'@'localhost' IDENTIFIED BY 'biji_password';
ALTER USER 'biji'@'127.0.0.1' IDENTIFIED BY 'biji_password';

GRANT ALL PRIVILEGES ON biji.* TO 'biji'@'localhost';
GRANT ALL PRIVILEGES ON biji.* TO 'biji'@'127.0.0.1';
FLUSH PRIVILEGES;
