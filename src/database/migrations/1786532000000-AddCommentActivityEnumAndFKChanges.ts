import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddCommentActivityEnumAndFKChanges
 *
 * Changes:
 * 1. Adds new ActivityActionType enum values:
 *    ISSUE_UPDATED, ASSIGNEE_CHANGED, COMMENT_ADDED,
 *    COMMENT_UPDATED, COMMENT_DELETED, ISSUE_DELETED
 *    (Renames ASSIGNED -> ASSIGNEE_CHANGED for consistency,
 *     but we ADD both to stay backward-compatible with existing rows)
 *
 * 2. Changes activity_logs.issueId FK from ON DELETE CASCADE
 *    to ON DELETE SET NULL, and makes issueId nullable.
 *    This allows ISSUE_DELETED activity records to survive
 *    after the referenced issue is removed.
 */
export class AddCommentActivityEnumAndFKChanges1786532000000 implements MigrationInterface {
    name = 'AddCommentActivityEnumAndFKChanges1786532000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Add new enum values to existing type
        //    PostgreSQL requires one ALTER TYPE per value
        await queryRunner.query(`ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'ISSUE_UPDATED'`);
        await queryRunner.query(`ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'ASSIGNEE_CHANGED'`);
        await queryRunner.query(`ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'COMMENT_ADDED'`);
        await queryRunner.query(`ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'COMMENT_UPDATED'`);
        await queryRunner.query(`ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'COMMENT_DELETED'`);
        await queryRunner.query(`ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'ISSUE_DELETED'`);

        // 2. Drop the CASCADE FK on activity_logs.issueId
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "FK_00e3335e7b66c0dfb320dbdc79c"`);

        // 3. Make issueId nullable (so SET NULL works after issue deletion)
        await queryRunner.query(`ALTER TABLE "activity_logs" ALTER COLUMN "issueId" DROP NOT NULL`);

        // 4. Re-add FK with ON DELETE SET NULL
        await queryRunner.query(`
            ALTER TABLE "activity_logs"
            ADD CONSTRAINT "FK_activity_logs_issue_set_null"
            FOREIGN KEY ("issueId")
            REFERENCES "issues"("id")
            ON DELETE SET NULL
            ON UPDATE NO ACTION
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore original CASCADE FK
        await queryRunner.query(`ALTER TABLE "activity_logs" DROP CONSTRAINT IF EXISTS "FK_activity_logs_issue_set_null"`);
        await queryRunner.query(`ALTER TABLE "activity_logs" ALTER COLUMN "issueId" SET NOT NULL`);
        await queryRunner.query(`
            ALTER TABLE "activity_logs"
            ADD CONSTRAINT "FK_00e3335e7b66c0dfb320dbdc79c"
            FOREIGN KEY ("issueId")
            REFERENCES "issues"("id")
            ON DELETE CASCADE
            ON UPDATE NO ACTION
        `);
        // Note: PostgreSQL does not support DROP VALUE from an enum type.
        // The added enum values cannot be removed without recreating the type.
    }
}
