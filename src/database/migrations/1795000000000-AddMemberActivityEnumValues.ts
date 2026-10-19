import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: AddMemberActivityEnumValues
 *
 * Adds new ActivityActionType enum values for Phase 9 Member Management:
 * MEMBER_ADDED, MEMBER_ROLE_CHANGED, MEMBER_REMOVED
 */
export class AddMemberActivityEnumValues1795000000000 implements MigrationInterface {
    name = 'AddMemberActivityEnumValues1795000000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'MEMBER_ADDED'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'MEMBER_ROLE_CHANGED'`,
        );
        await queryRunner.query(
            `ALTER TYPE "public"."activity_logs_actiontype_enum" ADD VALUE IF NOT EXISTS 'MEMBER_REMOVED'`,
        );
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // PostgreSQL does not support dropping values from an enum without recreating the type.
    }
}
