// src/app/core/auth.service.spec.ts
import { TestBed } from '@angular/core/testing';
import { of, EMPTY } from 'rxjs';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

describe('AuthService', () => {
  let service: AuthService;
  let apiSpy: jasmine.SpyObj<ApiService>;

  // Si tienes el tipo real, usa esto (ajusta la ruta):
  // import { Usuario } from '../../models/usuario.model';

  // Como alternativa segura (estructuralmente compatible):
  type Rol = 'estudiante' | 'profesor' | 'admin';
  type UsuarioLike = {
    _id: string;
    nombre: string;
    correo: string;
    rol: Rol;
  };

  beforeEach(() => {
    apiSpy = jasmine.createSpyObj<ApiService>('ApiService', ['login', 'renew']);

    // Muchos servicios validan token en el constructor → devolvemos un observable vacío
    apiSpy.renew.and.returnValue(EMPTY);

    TestBed.configureTestingModule({
      providers: [
        AuthService,
        { provide: ApiService, useValue: apiSpy },
      ],
    });

    localStorage.clear();
    service = TestBed.inject(AuthService);
  });

  it('login guarda token y usuario en localStorage', (done) => {
    // ✅ mapea 'rol' al union correcto
    const mockResp: { token: string; usuario: UsuarioLike } = {
      token: 'abc123',
      usuario: {
        _id: '1',
        nombre: 'Test',
        correo: 't@t.com',
        rol: 'estudiante', // <- ahora NO es string genérico
      },
    };

    apiSpy.login.and.returnValue(of(mockResp)); // Observable<{token; usuario}>

    // Ajusta a la firma real de tu servicio (objeto credenciales o 2 strings)
    const creds: any = { correo: 't@t.com', password: 'secret' };

    (service as any).login(creds).subscribe(() => {
      expect(localStorage.getItem('token')).toBe('abc123');
      const user = JSON.parse(localStorage.getItem('usuario') || 'null');
      expect(user?.correo).toBe('t@t.com');
      done();
    });
  });
});
