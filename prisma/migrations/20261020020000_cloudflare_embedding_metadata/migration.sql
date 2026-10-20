ALTER TABLE "PolicyDocument"
ADD COLUMN "embeddingProvider" TEXT,
ADD COLUMN "embeddingModel" TEXT,
ADD COLUMN "embeddingDimensions" INTEGER;
