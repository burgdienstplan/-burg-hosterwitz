const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Material = require('../models/Material');

// Multer Konfiguration für Bildupload
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/material');
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const erlaubteFormate = /jpeg|jpg|png/;
        const extname = erlaubteFormate.test(path.extname(file.originalname).toLowerCase());
        const mimetype = erlaubteFormate.test(file.mimetype);

        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb('Nur Bilder im Format JPG oder PNG erlaubt');
        }
    }
});

// Middleware für Kastellan/Hausmeister-Zugriff
const berechtigungMiddleware = (req, res, next) => {
    if (!req.session.user || !['kastellan', 'hausmeister'].includes(req.session.user.role)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
};

// Materialübersicht
router.get('/', berechtigungMiddleware, async (req, res) => {
    try {
        const { kategorie } = req.query;
        const filter = {};

        if (kategorie) filter.kategorie = kategorie;

        const materialien = await Material.find(filter).sort({ kategorie: 1, name: 1 });
        const niedrigerBestand = await Material.findeMaterialienMitNiedrigemBestand();

        res.render('material/uebersicht', {
            materialien,
            niedrigerBestand,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).render('error', { error });
    }
});

// Neues Material anlegen (nur Kastellan)
router.post('/', berechtigungMiddleware, upload.single('bild'), async (req, res) => {
    try {
        const {
            name,
            kategorie,
            bestand,
            einheit,
            mindestBestand,
            beschreibung,
            lagerort
        } = req.body;

        const material = new Material({
            name,
            kategorie,
            bestand: Number(bestand),
            einheit,
            mindestBestand: Number(mindestBestand),
            beschreibung,
            lagerort
        });

        if (req.file) {
            material.bild = {
                dateiname: req.file.filename,
                pfad: `/uploads/material/${req.file.filename}`,
                hochgeladenAm: new Date()
            };
        }

        await material.save();
        res.status(201).json(material);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Material bearbeiten (nur Kastellan)
router.put('/:id', berechtigungMiddleware, upload.single('bild'), async (req, res) => {
    try {
        const {
            name,
            kategorie,
            bestand,
            einheit,
            mindestBestand,
            beschreibung,
            lagerort
        } = req.body;

        const material = await Material.findById(req.params.id);
        if (!material) {
            return res.status(404).json({ error: 'Material nicht gefunden' });
        }

        material.name = name;
        material.kategorie = kategorie;
        material.bestand = Number(bestand);
        material.einheit = einheit;
        material.mindestBestand = Number(mindestBestand);
        material.beschreibung = beschreibung;
        material.lagerort = lagerort;

        if (req.file) {
            material.bild = {
                dateiname: req.file.filename,
                pfad: `/uploads/material/${req.file.filename}`,
                hochgeladenAm: new Date()
            };
        }

        await material.save();
        res.json(material);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bestand ändern (Kastellan und Hausmeister)
router.post('/:id/bestand', berechtigungMiddleware, async (req, res) => {
    try {
        const { menge, art, grund } = req.body;
        const material = await Material.findById(req.params.id);

        if (!material) {
            return res.status(404).json({ error: 'Material nicht gefunden' });
        }

        await material.bestandAendern(
            Number(menge),
            art,
            grund,
            req.session.user.username
        );

        res.json(material);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Bewegungshistorie abrufen
router.get('/:id/bewegungen', berechtigungMiddleware, async (req, res) => {
    try {
        const material = await Material.findById(req.params.id);
        
        if (!material) {
            return res.status(404).json({ error: 'Material nicht gefunden' });
        }

        res.render('material/bewegungen', {
            material,
            bewegungen: material.bewegungen,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).render('error', { error });
    }
});

module.exports = router;
