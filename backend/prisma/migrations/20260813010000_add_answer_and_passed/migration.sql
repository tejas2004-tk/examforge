-- AlterTable
ALTER TABLE Question ADD COLUMN correctAnswer JSON NULL;

-- AlterTable
ALTER TABLE Attempt ADD COLUMN passed BOOLEAN NULL;
