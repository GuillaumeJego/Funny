import { TestBed } from '@angular/core/testing';

import { DISPLAY_MODE_KEY, DisplayModeService } from './display-mode.service';

describe('DisplayModeService', () => {
  beforeEach(() => {
    localStorage.removeItem(DISPLAY_MODE_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    localStorage.removeItem(DISPLAY_MODE_KEY);
    document.documentElement.removeAttribute('data-theme');
  });

  it('est en mode Lumineux par défaut', () => {
    const service = TestBed.inject(DisplayModeService);
    expect(service.mode()).toBe('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  it('applique et retient le mode Sombre', () => {
    const service = TestBed.inject(DisplayModeService);
    service.set('dark');
    expect(service.mode()).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(DISPLAY_MODE_KEY)).toBe('dark');

    service.set('light');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(localStorage.getItem(DISPLAY_MODE_KEY)).toBe('light');
  });
});
