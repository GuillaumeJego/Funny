import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';

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

@Component({
  selector: 'app-membres',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './membres.component.html',
  styleUrl: './membres.component.scss'
})
export class MembresComponent implements OnInit {
  membres: MembreProfile[] = [];
  loading = true;
  filtersOpen = false;

  searchQuery = '';
  filterGender = '';
  filterRelationship = '';
  filterSmoking = '';
  filterVaping = '';
  filterAlcohol = '';

  constructor(private profileService: ProfileService, private router: Router) {}

  async ngOnInit() {
    const { data } = await this.profileService.getAllProfiles();
    this.membres = (data ?? []) as MembreProfile[];
    this.loading = false;
  }

  get filteredMembres(): MembreProfile[] {
    const q = this.searchQuery.toLowerCase().trim();
    return this.membres.filter(m => {
      if (q && !m.username.toLowerCase().includes(q) && !(m.bio ?? '').toLowerCase().includes(q)) return false;
      if (this.filterGender && m.gender !== this.filterGender) return false;
      if (this.filterRelationship && m.relationship !== this.filterRelationship) return false;
      if (this.filterSmoking && m.smoking !== this.filterSmoking) return false;
      if (this.filterVaping && m.vaping !== this.filterVaping) return false;
      if (this.filterAlcohol && m.alcohol !== this.filterAlcohol) return false;
      return true;
    });
  }

  get activeFilterCount(): number {
    return [this.filterGender, this.filterRelationship, this.filterSmoking, this.filterVaping, this.filterAlcohol]
      .filter(v => !!v).length;
  }

  resetFilters() {
    this.filterGender = '';
    this.filterRelationship = '';
    this.filterSmoking = '';
    this.filterVaping = '';
    this.filterAlcohol = '';
  }

  goToProfile(id: string) {
    this.router.navigate(['/membres', id]);
  }

  getInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }

  isPremium(m: MembreProfile): boolean {
    if (m.role === 'user_premium' || m.role === 'admin' || m.role === 'developer') return true;
    if (m.subscription_end_date) return new Date(m.subscription_end_date) > new Date();
    return false;
  }
}
