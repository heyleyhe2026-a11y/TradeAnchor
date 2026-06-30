-- CreateTable
CREATE TABLE "playbook_likes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "playbook_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "playbook_likes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "playbook_likes_user_id_playbook_id_key" ON "playbook_likes"("user_id", "playbook_id");

-- CreateIndex
CREATE INDEX "playbook_likes_user_id_idx" ON "playbook_likes"("user_id");

-- CreateIndex
CREATE INDEX "playbook_likes_playbook_id_idx" ON "playbook_likes"("playbook_id");

-- AddForeignKey
ALTER TABLE "playbook_likes" ADD CONSTRAINT "playbook_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "playbook_likes" ADD CONSTRAINT "playbook_likes_playbook_id_fkey" FOREIGN KEY ("playbook_id") REFERENCES "playbooks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
