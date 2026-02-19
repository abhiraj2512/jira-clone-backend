import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateBoard1771524283514 implements MigrationInterface {
    name = 'CreateBoard1771524283514'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."boards_type_enum" AS ENUM('SCRUM', 'KANBAN')`);
        await queryRunner.query(`CREATE TABLE "boards" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "projectId" uuid NOT NULL, "name" character varying(255) NOT NULL, "type" "public"."boards_type_enum" NOT NULL DEFAULT 'SCRUM', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_606923b0b068ef262dfdcd18f44" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_074efe1a079786d8c076bf00ff" ON "boards" ("projectId") `);
        await queryRunner.query(`ALTER TABLE "boards" ADD CONSTRAINT "FK_074efe1a079786d8c076bf00fff" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "boards" DROP CONSTRAINT "FK_074efe1a079786d8c076bf00fff"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_074efe1a079786d8c076bf00ff"`);
        await queryRunner.query(`DROP TABLE "boards"`);
        await queryRunner.query(`DROP TYPE "public"."boards_type_enum"`);
    }

}
