-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('IDLE', 'GENERATING', 'ERROR', 'COMPLETED');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "projectStatus" "ProjectStatus" NOT NULL DEFAULT 'IDLE';
