const express = require('express');
const router = express.Router();
const Aufgabe = require('../models/Aufgabe');
const Material = require('../models/Material');

// Middleware für Kastellan-Zugriff
const kastellanMiddleware = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'kastellan') {
        return res.status(403).json({ error: 'Nur für den Burgvogt zugänglich' });
    }
    next();
};

// Middleware für Hausmeister-Zugriff
const hausmeisterMiddleware = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'hausmeister') {
        return res.status(403).json({ error: 'Nur für den Burgmeister zugänglich' });
    }
    next();
};

// Aufgaben-Übersicht
router.get('/', async (req, res) => {
    try {
        const { kategorie, status, prioritaet } = req.query;
        const filter = {};

        if (kategorie) filter.kategorie = kategorie;
        if (status) filter.status = status;
        if (prioritaet) filter.prioritaet = prioritaet;

        // Hausmeister sieht nur seine Aufgaben
        if (req.session.user.role === 'hausmeister') {
            filter.zugewiesenAn = 'hausmeister';
        }

        const aufgaben = await Aufgabe.find(filter)
            .sort({ prioritaet: 1, terminBis: 1 });

        // Überfällige Aufgaben finden
        const ueberfaelligeAufgaben = await Aufgabe.findeUeberfaelligeAufgaben();

        res.render('aufgaben/uebersicht', {
            aufgaben,
            ueberfaelligeAufgaben,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).render('error', { error });
    }
});

// Neue Aufgabe erstellen (nur Kastellan)
router.post('/', kastellanMiddleware, async (req, res) => {
    try {
        const {
            titel,
            beschreibung,
            kategorie,
            prioritaet,
            terminBis,
            liftWartung
        } = req.body;

        const aufgabe = new Aufgabe({
            titel,
            beschreibung,
            kategorie,
            prioritaet,
            terminBis: new Date(terminBis),
            erstelltVon: req.session.user.username,
            liftWartung
        });

        await aufgabe.save();
        res.status(201).json(aufgabe);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Aufgabenstatus aktualisieren (Hausmeister)
router.patch('/:id/status', hausmeisterMiddleware, async (req, res) => {
    try {
        const { status, anmerkung } = req.body;
        const aufgabe = await Aufgabe.findById(req.params.id);

        if (!aufgabe) {
            return res.status(404).json({ error: 'Aufgabe nicht gefunden' });
        }

        await aufgabe.aktualisiereStatus(status, anmerkung);
        res.json(aufgabe);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lift-spezifische Routen

// Lift-Wartungsaufgaben abrufen
router.get('/lift', async (req, res) => {
    try {
        const wartungen = await Aufgabe.find({
            kategorie: 'lift',
            status: { $ne: 'abgeschlossen' }
        }).sort({ prioritaet: 1, terminBis: 1 });

        const materialien = await Material.find({ kategorie: 'lift' });

        res.render('aufgaben/lift', {
            wartungen,
            materialien,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).render('error', { error });
    }
});

// Neue Lift-Wartung erstellen (nur Kastellan)
router.post('/lift', kastellanMiddleware, async (req, res) => {
    try {
        const {
            titel,
            beschreibung,
            prioritaet,
            terminBis,
            wartungsArt,
            benoetigteMaterialien
        } = req.body;

        // Prüfen ob genügend Material vorhanden
        if (benoetigteMaterialien && benoetigteMaterialien.length > 0) {
            for (const material of benoetigteMaterialien) {
                const lagerMaterial = await Material.findById(material.id);
                if (!lagerMaterial || lagerMaterial.bestand < material.menge) {
                    return res.status(400).json({
                        error: `Nicht genügend ${lagerMaterial.name} auf Lager`
                    });
                }
            }
        }

        const wartung = new Aufgabe({
            titel,
            beschreibung,
            kategorie: 'lift',
            prioritaet,
            terminBis: new Date(terminBis),
            erstelltVon: req.session.user.username,
            liftWartung: {
                art: wartungsArt,
                materialien: benoetigteMaterialien
            }
        });

        await wartung.save();
        res.status(201).json(wartung);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Lift-Wartung abschließen (Hausmeister)
router.post('/lift/:id/abschluss', hausmeisterMiddleware, async (req, res) => {
    try {
        const { anmerkung, verwendeteMaterialien } = req.body;
        const wartung = await Aufgabe.findById(req.params.id);

        if (!wartung || wartung.kategorie !== 'lift') {
            return res.status(404).json({ error: 'Wartung nicht gefunden' });
        }

        // Material vom Lager abbuchen
        if (verwendeteMaterialien && verwendeteMaterialien.length > 0) {
            for (const material of verwendeteMaterialien) {
                const lagerMaterial = await Material.findById(material.id);
                if (!lagerMaterial) {
                    return res.status(404).json({
                        error: `Material ${material.id} nicht gefunden`
                    });
                }

                await lagerMaterial.bestandAendern(
                    material.menge,
                    'ausgang',
                    `Verwendet für Wartung: ${wartung.titel}`,
                    req.session.user.username
                );
            }
        }

        await wartung.aktualisiereStatus('abgeschlossen', anmerkung);
        res.json(wartung);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
