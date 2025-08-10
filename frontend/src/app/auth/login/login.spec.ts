// src/app/auth/login/login.spec.ts
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RouterTestingModule }       from '@angular/router/testing';
import { HttpClientTestingModule }   from '@angular/common/http/testing';
import { ReactiveFormsModule }       from '@angular/forms';

import { LoginComponent }            from './login.component';   // ✅ nombre real

describe('LoginComponent', () => {
  let fixture  : ComponentFixture<LoginComponent>;
  let component: LoginComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // ⬇️ componentes stand-alone van en  imports
      imports: [
        LoginComponent,            // ✅ stand-alone
        ReactiveFormsModule,       //   formulario reactivo usado en la plantilla
        RouterTestingModule,       //   satisface routerLink (si lo hubiera)
        HttpClientTestingModule    //   satisface AuthService → HttpClient
      ]
    }).compileComponents();

    fixture   = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});