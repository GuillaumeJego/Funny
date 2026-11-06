import {
  Component,
  OnInit,
  ChangeDetectionStrategy,
  inject,
  signal,
  computed,
} from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { isPremiumMember } from '../../core/utils/premium';
import { ClickableDirective } from '../../core/directives/clickable.directive';

interface MembreProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
  gender?: string;
  smoking?: string;
  vaping?: string;
  alcohol?: string;
  relationship?: string;
  subscription_end_date?: string;
}

import { RELATIONSHIP_OPTIONS } from '../../core/models/profile.model';
@Component({
  selector: 'app-membres',
  standalone: true,
  imports: [ClickableDirective, FormsModule],
  templateUrl: './membres.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './membres.component.scss',
})
export class MembresComponent implements OnInit {
  private profileService = inject(ProfileService);
  private router = inject(Router);

  readonly membres = signal<MembreProfile[]>([]);
  readonly loading = signal(true);
  readonly filtersOpen = signal(false);

  readonly searchQuery = signal('');
  readonly filterGender = signal('');
  readonly filterRelationship = signal('');
  relationshipOptions = RELATIONSHIP_OPTIONS;
  readonly filterSmoking = signal('');
  readonly filterVaping = signal('');
  readonly filterAlcohol = signal('');

  async ngOnInit() {
    const { data } = await this.profileService.getAllProfiles();
    this.membres.set((data ?? []) as MembreProfile[]);
    this.loading.set(false);
  }

  readonly filteredMembres = computed<MembreProfile[]>(() => {
    const q = this.searchQuery().toLowerCase().trim();
    return this.membres().filter((m) => {
      if (q && !m.username.toLowerCase().includes(q) && !(m.bio ?? '').toLowerCase().includes(q))
        return false;
      if (this.filterGender() && m.gender !== this.filterGender()) return false;
      if (this.filterRelationship() && m.relationship !== this.filterRelationship()) return false;
      if (this.filterSmoking() && m.smoking !== this.filterSmoking()) return false;
      if (this.filterVaping() && m.vaping !== this.filterVaping()) return false;
      if (this.filterAlcohol() && m.alcohol !== this.filterAlcohol()) return false;
      return true;
    });
  });

  readonly activeFilterCount = computed<number>(() => {
    return [
      this.filterGender(),
      this.filterRelationship(),
      this.filterSmoking(),
      this.filterVaping(),
      this.filterAlcohol(),
    ].filter((v) => !!v).length;
  });

  resetFilters() {
    this.filterGender.set('');
    this.filterRelationship.set('');
    this.filterSmoking.set('');
    this.filterVaping.set('');
    this.filterAlcohol.set('');
  }

  goToProfile(id: string) {
    this.router.navigate(['/membres', id]);
  }

  getInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  isPremium(m: MembreProfile): boolean {
    return isPremiumMember(m);
  }
}
