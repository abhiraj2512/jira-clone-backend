import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateCommentsTable1772512865720 implements MigrationInterface {
    name = 'CreateCommentsTable1772512865720'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "comments" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "issueId" uuid NOT NULL, "userId" uuid NOT NULL, "content" text NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_8bf68bc960f2b69e818bdb90dcb" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_7e8d7c49f218ebb14314fdb374" ON "comments" ("userId") `);
        await queryRunner.query(`CREATE INDEX "IDX_87df5cc9d40c252f38b85618be" ON "comments" ("issueId") `);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_87df5cc9d40c252f38b85618be1" FOREIGN KEY ("issueId") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "comments" ADD CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_7e8d7c49f218ebb14314fdb3749"`);
        await queryRunner.query(`ALTER TABLE "comments" DROP CONSTRAINT "FK_87df5cc9d40c252f38b85618be1"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_87df5cc9d40c252f38b85618be"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_7e8d7c49f218ebb14314fdb374"`);
        await queryRunner.query(`DROP TABLE "comments"`);
    }

}
