import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProfileService } from '../../core/services/profile.service';

interface MembreProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  role: string;
}

@Component({
  selector: 'app-membres',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './membres.component.html',
  styleUrl: './membres.component.scss'
})
export class MembresComponent implements OnInit {
  membres: MembreProfile[] = [];
  loading = true;

  constructor(private profileService: ProfileService) {}

  async ngOnInit() {
    const { data } = await this.profileService.getAllProfiles();
    this.membres = (data ?? []) as MembreProfile[];
    this.loading = false;
  }

  getInitial(username: string): string {
    return username.charAt(0).toUpperCase();
  }
}
