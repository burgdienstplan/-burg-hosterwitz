const express = require('express');
const router = express.Router();
const Dienstplan = require('../models/Dienstplan');
const Mitarbeiter = require('../models/Mitarbeiter');

// Middleware für Burgvogt-Berechtigung
const burgvogtMiddleware = (req, res, next) => {
    if (!req.session.user || req.session.user.rolle !== 'burgvogt') {
        return res.status(403).json({ error: 'Nur für den Burgvogt zugänglich' });
    }
    next();
};

// Middleware für Museumsführer-Berechtigung
const museumsführerMiddleware = (req, res, next) => {
    if (!req.session.user || !['burgvogt', 'museumsführer'].includes(req.session.user.rolle)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    next();
};

// Dienstplan anzeigen
router.get('/', async (req, res) => {
    try {
        const monat = parseInt(req.query.monat) || new Date().getMonth() + 1;
        const jahr = parseInt(req.query.jahr) || new Date().getFullYear();
        
        // Nur Monate in der Saison erlauben (April bis November)
        if (monat < 4 || monat > 11) {
            return res.redirect('/dienstplan?monat=4&jahr=' + jahr);
        }

        const mitarbeiter = await Mitarbeiter.find();
        const dienstplan = await Dienstplan.find({
            datum: {
                $gte: new Date(jahr, monat - 1, 1),
                $lt: new Date(jahr, monat, 1)
            }
        }).populate('mitarbeiter');

        res.render('dienstplan/uebersicht', {
            monat,
            jahr,
            mitarbeiter,
            dienstplan: dienstplan.map(schicht => ({
                datum: schicht.datum,
                position: schicht.position,
                mitarbeiterName: schicht.mitarbeiter.name,
                status: schicht.status
            }))
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ein Fehler ist aufgetreten' });
    }
});

// Neue Schicht erstellen
router.post('/schicht', async (req, res) => {
    try {
        const { datum, position, mitarbeiter } = req.body;
        
        // Prüfen, ob das Datum in der Saison liegt
        if (!Dienstplan.pruefeIstInSaison(datum)) {
            return res.status(400).json({ error: 'Die Burg ist an diesem Tag geschlossen' });
        }

        // Prüfen, ob der Mitarbeiter bereits eingeteilt ist
        const istVerfuegbar = await Dienstplan.pruefeMitarbeiterVerfuegbar(datum, mitarbeiter);
        if (!istVerfuegbar) {
            return res.status(400).json({ error: 'Der Mitarbeiter ist an diesem Tag bereits eingeteilt' });
        }

        // Wenn es eine Shop-Eingang-Position ist, prüfen ob diese bereits besetzt ist
        if (position === 'shop_eingang') {
            const shopEingangBesetzt = await Dienstplan.pruefeShopEingangBesetzung(datum);
            if (shopEingangBesetzt) {
                return res.status(400).json({ error: 'Der Shop-Eingang ist bereits besetzt' });
            }
        }

        // Museumsführer dürfen nur Führungen vorschlagen
        if (req.session.user.rolle === 'museumsführer' && position !== 'fuehrung') {
            return res.status(403).json({ error: 'Museumsführer dürfen nur Führungen vorschlagen' });
        }

        const neueSchicht = new Dienstplan({
            datum,
            position,
            mitarbeiter
        });

        await neueSchicht.save();
        res.status(201).json(neueSchicht);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ein Fehler ist aufgetreten' });
    }
});

// Führung bestätigen (nur Burgvogt)
router.put('/schicht/:id/bestaetigen', burgvogtMiddleware, async (req, res) => {
    try {
        const schicht = await Dienstplan.findById(req.params.id);
        
        if (!schicht) {
            return res.status(404).json({ error: 'Schicht nicht gefunden' });
        }
        
        if (schicht.position !== 'fuehrung') {
            return res.status(400).json({ error: 'Nur Führungen können bestätigt werden' });
        }

        schicht.status = 'bestaetigt';
        await schicht.save();
        
        res.json(schicht);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ein Fehler ist aufgetreten' });
    }
});

// Schicht löschen (nur Burgvogt)
router.delete('/schicht/:id', burgvogtMiddleware, async (req, res) => {
    try {
        const schicht = await Dienstplan.findById(req.params.id);
        
        if (!schicht) {
            return res.status(404).json({ error: 'Schicht nicht gefunden' });
        }

        // Shop-Eingang-Schichten können nicht gelöscht werden, wenn keine Ersatzbesetzung vorhanden ist
        if (schicht.position === 'shop_eingang' && schicht.status === 'bestaetigt') {
            return res.status(400).json({ error: 'Der Shop-Eingang muss besetzt sein' });
        }

        await schicht.remove();
        res.status(204).send();
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Ein Fehler ist aufgetreten' });
    }
});

module.exports = router;
