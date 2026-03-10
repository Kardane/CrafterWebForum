-- AlterTable
ALTER TABLE "Post" ADD COLUMN "board" TEXT DEFAULT 'develope';
ALTER TABLE "Post" ADD COLUMN "serverAddress" TEXT;

-- CreateIndex
CREATE INDEX "Post_board_deletedAt_updatedAt_idx" ON "Post"("board", "deletedAt", "updatedAt");

