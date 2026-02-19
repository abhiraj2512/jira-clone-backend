import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateSprint1771525824235 implements MigrationInterface {
    name = 'CreateSprint1771525824235'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."sprints_status_enum" AS ENUM('PLANNED', 'ACTIVE', 'COMPLETED')`);
        await queryRunner.query(`CREATE TABLE "sprints" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "name" character varying(255) NOT NULL, "goal" text, "startDate" date NOT NULL, "endDate" date NOT NULL, "status" "public"."sprints_status_enum" NOT NULL DEFAULT 'PLANNED', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_6800aa2e0f508561812c4b9afb4" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_12a81f920cc034f4c532766bf1" ON "sprints" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "sprints" ADD CONSTRAINT "FK_12a81f920cc034f4c532766bf18" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "sprints" DROP CONSTRAINT "FK_12a81f920cc034f4c532766bf18"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_12a81f920cc034f4c532766bf1"`);
        await queryRunner.query(`DROP TABLE "sprints"`);
        await queryRunner.query(`DROP TYPE "public"."sprints_status_enum"`);
    }

}
