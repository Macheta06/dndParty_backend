-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "joinCode" TEXT NOT NULL,
    "masterId" INTEGER NOT NULL,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" SERIAL NOT NULL,
    "is_npc" BOOLEAN NOT NULL,
    "name" TEXT NOT NULL,
    "class" TEXT NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "race" TEXT NOT NULL,
    "background" TEXT NOT NULL,
    "alignment" TEXT NOT NULL,
    "exp" INTEGER NOT NULL DEFAULT 0,
    "proficiency" INTEGER NOT NULL DEFAULT 2,
    "inspiration" INTEGER NOT NULL DEFAULT 0,
    "strength" INTEGER NOT NULL,
    "dexterity" INTEGER NOT NULL,
    "constitution" INTEGER NOT NULL,
    "intelligence" INTEGER NOT NULL,
    "wisdom" INTEGER NOT NULL,
    "charisma" INTEGER NOT NULL,
    "armor" INTEGER NOT NULL,
    "initiative" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "max_hp" INTEGER NOT NULL,
    "current_hp" INTEGER NOT NULL,
    "temporary_hp" INTEGER NOT NULL DEFAULT 0,
    "hitDice" TEXT NOT NULL,
    "gold_coins" INTEGER NOT NULL DEFAULT 0,
    "silver_coins" INTEGER NOT NULL DEFAULT 0,
    "copper_coins" INTEGER NOT NULL DEFAULT 0,
    "equipment" JSONB NOT NULL,
    "proficiencies" JSONB NOT NULL,
    "personality_traits" TEXT,
    "ideals" TEXT,
    "bonds" TEXT,
    "flaws" TEXT,
    "feature_traits" JSONB,
    "spells" JSONB,
    "age" INTEGER,
    "height" DOUBLE PRECISION,
    "skin" TEXT,
    "weight" DOUBLE PRECISION,
    "hair" TEXT,
    "appearance_img" TEXT,
    "story" TEXT,
    "allies" TEXT,
    "userId" INTEGER NOT NULL,
    "gameId" TEXT,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Monster" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "armor" INTEGER NOT NULL,
    "hp" INTEGER NOT NULL,
    "speed" INTEGER NOT NULL,
    "fly_speed" INTEGER,
    "strength" INTEGER NOT NULL,
    "dexterity" INTEGER NOT NULL,
    "constitution" INTEGER NOT NULL,
    "intelligence" INTEGER NOT NULL,
    "wisdom" INTEGER NOT NULL,
    "charisma" INTEGER NOT NULL,
    "skills" JSONB,
    "senses" JSONB,
    "languages" TEXT,
    "challenge" TEXT NOT NULL,
    "actions" JSONB NOT NULL,

    CONSTRAINT "Monster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameMonster" (
    "id" SERIAL NOT NULL,
    "custom_name" TEXT,
    "current_hp" INTEGER NOT NULL,
    "initiative" INTEGER,
    "gameId" TEXT NOT NULL,
    "monsterId" INTEGER NOT NULL,

    CONSTRAINT "GameMonster_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Game_joinCode_key" ON "Game"("joinCode");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Monster_name_key" ON "Monster"("name");

-- AddForeignKey
ALTER TABLE "Game" ADD CONSTRAINT "Game_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMonster" ADD CONSTRAINT "GameMonster_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameMonster" ADD CONSTRAINT "GameMonster_monsterId_fkey" FOREIGN KEY ("monsterId") REFERENCES "Monster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
