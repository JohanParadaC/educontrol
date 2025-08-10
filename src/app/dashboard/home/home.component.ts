// src/app/dashboard/home/home.component.ts
import { Component, OnInit }          from '@angular/core';
import { CommonModule }              from '@angular/common';
import { MatTableModule }            from '@angular/material/table'; // para stand-alone
import { MatTableDataSource }        from '@angular/material/table';

import { ApiService }                from '../../core/api.service';
import { Curso }                     from '../../models/curso.model';

@Component({
  selector:  'app-home',
  standalone:true,
  templateUrl:'./home.component.html',
  styleUrls: ['./home.component.scss'],
  imports:[ CommonModule, MatTableModule ]          // 👈 si es stand-alone
})
export class HomeComponent implements OnInit {
  displayedColumns = ['nombre','profesor'];          // para la cabecera
  dataSource      = new MatTableDataSource<Curso>(); // 👉 evita warning de tipado

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getCursos().subscribe(cs => this.dataSource.data = cs);
  }
}