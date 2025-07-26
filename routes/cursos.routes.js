const express = require('express');
const router = require('express').Router();
const Curso = require('../models/Curso');

// Crear curso
router.post('/', async (req, res) => {
  try {
    const cursos = new Curso(req.body);
    res.status(201).json(await cursos.save());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Listar cursos (populando el profesor)
router.get('/', async (req, res) => {
  const cursos = await Curso.find().populate('profesor', 'nombre correo');
  res.json(cursos);
});

module.exports = router;