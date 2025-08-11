import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';
import { of } from 'rxjs';

import { LoginComponent } from './login.component';
import { AuthService } from '../../core/auth.service';

describe('LoginComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      // Standalone → en imports
      imports: [
        LoginComponent,
        ReactiveFormsModule,
        HttpClientTestingModule,
        RouterTestingModule
      ],
      providers: [
        { provide: AuthService, useValue: { login: () => of({}) } }
      ],
    }).compileComponents();
  });

  it('el formulario es inválido al inicio', () => {
    const fixture = TestBed.createComponent(LoginComponent);
    const comp: any = fixture.componentInstance;
    fixture.detectChanges();

    const form = comp.form ?? comp.loginForm;
    expect(form).toBeTruthy();
    expect(form.invalid).toBeTrue();
  });
});