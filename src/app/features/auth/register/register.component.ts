import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss'
})
export class RegisterComponent {
  email = '';
  password = '';
  confirmPassword = '';
  errorMessage = '';
  successMessage = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  async onRegister() {
    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Les mots de passe ne correspondent pas.';
      this.loading = false;
      return;
    }

    const { error } = await this.authService.register(this.email, this.password);

    if (error) {
      this.errorMessage = 'Une erreur est survenue. Veuillez réessayer.';
    } else {
      this.successMessage = 'Inscription réussie ! Vérifiez votre email pour confirmer votre compte.';
    }

    this.loading = false;
  }
}