import { Injectable, inject } from '@angular/core';
import { AdminRepository } from '../repositories/admin.repository';
import { StatsQuery } from '../models/stats.model';

/** Statistiques de connexion, réservées aux admins (vérifié par le serveur). */
@Injectable({ providedIn: 'root' })
export class StatsService {
  private admin = inject(AdminRepository);

  async getStats(query: StatsQuery) {
    return await this.admin.getStats(query);
  }
}
