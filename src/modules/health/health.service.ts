import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class HealthService {
    constructor(private readonly dataSource: DataSource) { }

    async checkHealth() {
        const databaseStatus = await this.checkDatabase();

        return {
            status: 'ok',
            database: databaseStatus,
        };
    }

    private async checkDatabase(): Promise<string> {
        try {
            await this.dataSource.query('SELECT 1');
            return 'connected';
        } catch (error) {
            return 'disconnected';
        }
    }
}
