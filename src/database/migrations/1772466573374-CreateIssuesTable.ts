import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateIssuesTable1772466573374 implements MigrationInterface {
    name = 'CreateIssuesTable1772466573374'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."issues_issuetype_enum" AS ENUM('EPIC', 'STORY', 'TASK', 'BUG')`);
        await queryRunner.query(`CREATE TYPE "public"."issues_status_enum" AS ENUM('TODO', 'IN_PROGRESS', 'DONE')`);
        await queryRunner.query(`CREATE TYPE "public"."issues_priority_enum" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')`);
        await queryRunner.query(`CREATE TABLE "issues" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "boardId" uuid NOT NULL, "sprintId" uuid, "issueKey" character varying(20) NOT NULL, "title" character varying(255) NOT NULL, "description" text, "issueType" "public"."issues_issuetype_enum" NOT NULL, "status" "public"."issues_status_enum" NOT NULL DEFAULT 'TODO', "priority" "public"."issues_priority_enum" NOT NULL DEFAULT 'MEDIUM', "reporterId" uuid NOT NULL, "assigneeId" uuid, "storyPoints" integer, "dueDate" date, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_5ef48c805865cf200330ba757ec" UNIQUE ("issueKey"), CONSTRAINT "PK_9d8ecbbeff46229c700f0449257" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_b7fd6df20da19c630741ea9045" ON "issues" ("status") `);
        await queryRunner.query(`CREATE INDEX "IDX_9a9187fec2a363ed3bbea2a6b6" ON "issues" ("assigneeId") `);
        await queryRunner.query(`CREATE INDEX "IDX_084190ca006e446a6387baef59" ON "issues" ("reporterId") `);
        await queryRunner.query(`CREATE INDEX "IDX_aed680c6a19809d2cca92f6d41" ON "issues" ("sprintId") `);
        await queryRunner.query(`CREATE INDEX "IDX_91861b1cdc2ccee310ff27bb66" ON "issues" ("boardId") `);
        await queryRunner.query(`CREATE INDEX "IDX_9f82fdfad8087663f95e203da6" ON "issues" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "issues" ADD CONSTRAINT "FK_9f82fdfad8087663f95e203da67" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "issues" ADD CONSTRAINT "FK_91861b1cdc2ccee310ff27bb665" FOREIGN KEY ("boardId") REFERENCES "boards"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "issues" ADD CONSTRAINT "FK_aed680c6a19809d2cca92f6d41e" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "issues" ADD CONSTRAINT "FK_084190ca006e446a6387baef595" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "issues" ADD CONSTRAINT "FK_9a9187fec2a363ed3bbea2a6b63" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "issues" DROP CONSTRAINT "FK_9a9187fec2a363ed3bbea2a6b63"`);
        await queryRunner.query(`ALTER TABLE "issues" DROP CONSTRAINT "FK_084190ca006e446a6387baef595"`);
        await queryRunner.query(`ALTER TABLE "issues" DROP CONSTRAINT "FK_aed680c6a19809d2cca92f6d41e"`);
        await queryRunner.query(`ALTER TABLE "issues" DROP CONSTRAINT "FK_91861b1cdc2ccee310ff27bb665"`);
        await queryRunner.query(`ALTER TABLE "issues" DROP CONSTRAINT "FK_9f82fdfad8087663f95e203da67"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9f82fdfad8087663f95e203da6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_91861b1cdc2ccee310ff27bb66"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_aed680c6a19809d2cca92f6d41"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_084190ca006e446a6387baef59"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_9a9187fec2a363ed3bbea2a6b6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_b7fd6df20da19c630741ea9045"`);
        await queryRunner.query(`DROP TABLE "issues"`);
        await queryRunner.query(`DROP TYPE "public"."issues_priority_enum"`);
        await queryRunner.query(`DROP TYPE "public"."issues_status_enum"`);
        await queryRunner.query(`DROP TYPE "public"."issues_issuetype_enum"`);
    }

}
