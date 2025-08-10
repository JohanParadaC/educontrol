import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule }       from '@angular/router/testing';   // 👉 si la plantilla usa routerLink
import { HttpClientTestingModule }   from '@angular/common/http/testing';

import { NavbarComponent }           from './navbar.component';        // ✅ nombre correcto

describe('NavbarComponent', () => {
  let fixture : ComponentFixture<NavbarComponent>;
  let component: NavbarComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // 👉 stand-alone => va en imports, no en declarations
      imports: [
        NavbarComponent,
        RouterTestingModule,      // (opcional) satisface routerLink
        HttpClientTestingModule   // (opcional) si AuthService hace peticiones HTTP
      ]
    }).compileComponents();

    fixture   = TestBed.createComponent(NavbarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});