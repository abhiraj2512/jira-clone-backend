import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddSprintManagementChanges
 *
 * Changes:
 * 1. Make sprints.startDate and sprints.endDate nullable
 *    (the initial CreateSprint migration made them NOT NULL, but we need flexibility)
 *
 * 2. Add new ActivityActionType enum values for sprint lifecycle:
 *    SPRINT_CREATED, SPRINT_STARTED, SPRINT_COMPLETED,
 *    ISSUE_ADDED_TO_SPRINT, ISSUE_REMOVED_FROM_SPRINT
 */
export class AddSprintManagementChanges1790000000000 implements MigrationInterface {
    name = 'AddSprintManagementChanges1790000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Make startDate nullable
        await queryRunner.query(
            `ALTER TABLE "sprints" ALTER COLUMN "startDate" DROP NOT NULL`,
        );

        // 2. Make endDate nullable
        await queryRunner.query(
            `ALTER TABLE "sprints" ALTER COLUMN "endDate" DROP NOT NULL`,
        );

        // 3. Add new sprint activity enum values
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'SPRINT_CREATED'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'SPRINT_STARTED'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'SPRINT_COMPLETED'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'ISSUE_ADDED_TO_SPRINT'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'ISSUE_REMOVED_FROM_SPRINT'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Restore NOT NULL constraint on startDate and endDate
        // Note: This will fail if there are rows with NULL values — clean up data first.
        await queryRunner.query(
            `UPDATE "sprints" SET "startDate" = NOW() WHERE "startDate" IS NULL`,
        );
        await queryRunner.query(
            `UPDATE "sprints" SET "endDate" = NOW() WHERE "endDate" IS NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "sprints" ALTER COLUMN "startDate" SET NOT NULL`,
        );
        await queryRunner.query(
            `ALTER TABLE "sprints" ALTER COLUMN "endDate" SET NOT NULL`,
        );
        // Note: PostgreSQL does not support removing enum values without recreating the type.
        // The added enum values for sprint activity cannot be removed cleanly.
    }
}
