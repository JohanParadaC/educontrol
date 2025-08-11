import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ApiService } from './api.service';
import { environment } from '../../environments/environment';

describe('ApiService', () => {
  let service: ApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ApiService],
    });
    service = TestBed.inject(ApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getCursos() hace GET a /cursos', () => {
    const mockCursos = [{ _id: '1', titulo: 'Angular' }];

    service.getCursos().subscribe((resp: any) => {
      expect(resp).toBeTruthy();
    });

    const req = httpMock.expectOne(`${environment.baseUrl}/cursos`);
    expect(req.request.method).toBe('GET');
    req.flush({ ok: true, cursos: mockCursos });
  });
});