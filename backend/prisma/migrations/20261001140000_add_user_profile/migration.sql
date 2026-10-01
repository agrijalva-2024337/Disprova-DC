-- Perfil: nombre de usuario para entrar, y foto opcional.
ALTER TABLE "users" ADD COLUMN "usuario" TEXT;
ALTER TABLE "users" ADD COLUMN "avatar_url" TEXT;

UPDATE "users" AS u
SET "usuario" = CASE
  WHEN (
    SELECT COUNT(*)
    FROM "users" AS o
    WHERE split_part(o."email", '@', 1) = split_part(u."email", '@', 1)
  ) > 1
  THEN split_part(u."email", '@', 1) || '-' || u."id"::text
  ELSE split_part(u."email", '@', 1)
END
WHERE u."usuario" IS NULL;

CREATE UNIQUE INDEX "users_usuario_key" ON "users"("usuario");
