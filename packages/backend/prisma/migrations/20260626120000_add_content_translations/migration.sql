-- CreateTable
CREATE TABLE "content_translations" (
    "id" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "source_locale" TEXT NOT NULL,
    "target_locale" TEXT NOT NULL,
    "source_hash" TEXT NOT NULL,
    "translated" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_translations_entity_type_entity_id_field_target_locale_source_hash_key" ON "content_translations"("entity_type", "entity_id", "field", "target_locale", "source_hash");

-- CreateIndex
CREATE INDEX "content_translations_entity_type_entity_id_target_locale_idx" ON "content_translations"("entity_type", "entity_id", "target_locale");
