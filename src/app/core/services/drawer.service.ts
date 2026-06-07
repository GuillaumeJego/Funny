import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DrawerService {
  readonly closeAll$ = new Subject<void>();

  closeAll() {
    this.closeAll$.next();
  }
}
