import { TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { HttpClientTestingModule } from '@angular/common/http/testing';
import { RouterTestingModule } from '@angular/router/testing';

import { RegisterComponent } from './register.component';

describe('RegisterComponent — confirmación de contraseña', () => {
  let comp: any;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RegisterComponent,
        ReactiveFormsModule,
        HttpClientTestingModule,
        RouterTestingModule,
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(RegisterComponent);
    comp = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** Rellena todo el formulario menos la confirmación. */
  const rellenarBase = () =>
    comp.form.patchValue({
      nombre: 'Ana',
      correo: 'ana@mail.com',
      password: 'Secret123',
    });

  it('el formulario es inválido si las contraseñas no coinciden', () => {
    rellenarBase();
    comp.form.patchValue({ password2: 'OtraCosa123' });

    expect(comp.form.valid).toBeFalse();
    expect(comp.form.get('password2').hasError('noCoincide')).toBeTrue();
  });

  it('el formulario es válido cuando coinciden', () => {
    rellenarBase();
    comp.form.patchValue({ password2: 'Secret123' });

    expect(comp.form.valid).toBeTrue();
    expect(comp.form.get('password2').hasError('noCoincide')).toBeFalse();
  });

  it('el error desaparece al corregir la confirmación, sin borrar los demás', () => {
    rellenarBase();
    comp.form.patchValue({ password2: 'mal' });
    expect(comp.form.get('password2').hasError('noCoincide')).toBeTrue();

    comp.form.patchValue({ password2: 'Secret123' });
    expect(comp.form.get('password2').errors).toBeNull();
  });

  it('confirmación vacía deja el formulario inválido por "required"', () => {
    rellenarBase();
    comp.form.patchValue({ password2: '' });

    expect(comp.form.valid).toBeFalse();
    expect(comp.form.get('password2').hasError('required')).toBeTrue();
  });

  it('cambiar la contraseña original revalida la confirmación', () => {
    rellenarBase();
    comp.form.patchValue({ password2: 'Secret123' });
    expect(comp.form.valid).toBeTrue();

    // El usuario vuelve atrás y retoca la primera: la confirmación ya no vale.
    comp.form.patchValue({ password: 'Distinta123' });

    expect(comp.form.valid).toBeFalse();
    expect(comp.form.get('password2').hasError('noCoincide')).toBeTrue();
  });
});
