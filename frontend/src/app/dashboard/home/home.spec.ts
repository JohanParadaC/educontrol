import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpClientTestingModule }   from '@angular/common/http/testing';
import { RouterTestingModule }       from '@angular/router/testing';

import { HomeComponent }             from './home.component';   // ✅ nombre real

describe('HomeComponent', () => {
  let fixture  : ComponentFixture<HomeComponent>;
  let component: HomeComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // ⬇️  Los componentes stand-alone se listan en imports
      imports: [
        HomeComponent,              // ✅ stand-alone
        RouterTestingModule,        // (opcional) satisface routerLink si lo usas
        HttpClientTestingModule     // (opcional) si el componente inyecta ApiService
      ]
    }).compileComponents();

    fixture   = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});