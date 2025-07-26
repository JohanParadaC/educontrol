const express = require('express');
const router = require('express').Router();
const Inscripcion = require('../models/Inscripcion');

// Crear inscripción
router.post('/', async (req, res) => {
  try {
    const ins = new Inscripcion(req.body);
    res.status(201).json(await ins.save());
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Listar inscripciones (populate de estudiante y curso→profesor)
router.get('/', async (req, res) => {
  const lista = await Inscripcion.find()
    .populate('estudiante', 'nombre correo')
    .populate({
      path: 'curso',
      populate: { path: 'profesor', select: 'nombre correo' }
    });
  res.json(lista);
});

module.exports = router;