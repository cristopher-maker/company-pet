import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class UiService {
  private menuOpen = new BehaviorSubject<boolean>(false);
  public menuOpen$ = this.menuOpen.asObservable();

  public toggleMenu(): void {
    this.menuOpen.next(!this.menuOpen.value);
  }

  public closeMenu(): void {
    this.menuOpen.next(false);
  }
}