import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateActivityLogsTable1772513514948 implements MigrationInterface {
    name = 'CreateActivityLogsTable1772513514948'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."activity_logs_actiontype_enum" AS ENUM('STATUS_CHANGED', 'ASSIGNED', 'PRIORITY_CHANGED', 'SPRINT_CHANGED', 'ISSUE_CREATED')`);
        await queryRunner.query(`CREATE TABLE "activity_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "issueId" uuid NOT NULL, "userId" uuid NOT NULL, "actionType" "public"."activity_logs_actiontype_enum" NOT NULL, "oldValue" jsonb, "newValue" jsonb, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_f25287b6140c5ba18d38776a796" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_00e3335e7b66c0dfb320dbdc79" ON "activity_logs" ("issueId") `);
        await queryRunner.query(`ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_00e3335e7b66c0dfb320dbdc79c" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "activity_logs" ADD CONSTRAINT "FK_597e6df96098895bf19d4b5ea45" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_597e6df96098895bf19d4b5ea45"`);
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT "FK_00e3335e7b66c0dfb320dbdc79c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_00e3335e7b66c0dfb320dbdc79"`);
        await queryRunner.query(`DROP TABLE "activity_logs"`);
        await queryRunner.query(`DROP TYPE "public"."activity_logs_actiontype_enum"`);
    }

}
