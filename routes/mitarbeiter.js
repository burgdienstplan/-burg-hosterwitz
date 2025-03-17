const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const Mitarbeiter = require('../models/Mitarbeiter');

// Middleware für Kastellan-Zugriff
const kastellanMiddleware = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'kastellan') {
        return res.status(403).json({ error: 'Nur für den Burgvogt zugänglich' });
    }
    next();
};

// Alle Mitarbeiter abrufen (nur Kastellan)
router.get('/', kastellanMiddleware, async (req, res) => {
    try {
        const mitarbeiter = await Mitarbeiter.find()
            .select('-password')
            .sort({ name: 1 });
        
        res.render('mitarbeiter/liste', {
            mitarbeiter,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).render('error', { error });
    }
});

// Neuen Mitarbeiter anlegen (nur Kastellan)
router.post('/', kastellanMiddleware, async (req, res) => {
    try {
        const {
            name,
            adresse,
            telefon,
            email,
            username,
            password,
            rolle
        } = req.body;

        // Prüfen ob Username oder Email bereits existiert
        const existingUser = await Mitarbeiter.findOne({
            $or: [{ username }, { email }]
        });

        if (existingUser) {
            return res.status(400).json({
                error: 'Benutzername oder E-Mail bereits vergeben'
            });
        }

        const mitarbeiter = new Mitarbeiter({
            name,
            adresse,
            telefon,
            email,
            username,
            password, // wird durch Schema-Middleware gehasht
            rolle
        });

        await mitarbeiter.save();
        res.status(201).json({ 
            message: 'Mitarbeiter erfolgreich angelegt',
            mitarbeiter: {
                ...mitarbeiter.toObject(),
                password: undefined
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mitarbeiter bearbeiten (nur Kastellan)
router.put('/:id', kastellanMiddleware, async (req, res) => {
    try {
        const {
            name,
            adresse,
            telefon,
            email,
            rolle,
            aktiv
        } = req.body;

        const mitarbeiter = await Mitarbeiter.findById(req.params.id);
        if (!mitarbeiter) {
            return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
        }

        // Prüfen ob Email bereits von anderem Mitarbeiter verwendet wird
        if (email !== mitarbeiter.email) {
            const existingEmail = await Mitarbeiter.findOne({ 
                email,
                _id: { $ne: req.params.id }
            });
            if (existingEmail) {
                return res.status(400).json({ error: 'E-Mail bereits vergeben' });
            }
        }

        // Daten aktualisieren
        mitarbeiter.name = name;
        mitarbeiter.adresse = adresse;
        mitarbeiter.telefon = telefon;
        mitarbeiter.email = email;
        mitarbeiter.rolle = rolle;
        mitarbeiter.aktiv = aktiv;

        await mitarbeiter.save();
        res.json({ 
            message: 'Mitarbeiter erfolgreich aktualisiert',
            mitarbeiter: {
                ...mitarbeiter.toObject(),
                password: undefined
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Passwort zurücksetzen (nur Kastellan)
router.post('/:id/reset-password', kastellanMiddleware, async (req, res) => {
    try {
        const { newPassword } = req.body;
        const mitarbeiter = await Mitarbeiter.findById(req.params.id);

        if (!mitarbeiter) {
            return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
        }

        mitarbeiter.password = newPassword; // wird durch Schema-Middleware gehasht
        await mitarbeiter.save();

        res.json({ message: 'Passwort erfolgreich zurückgesetzt' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Mitarbeiter sperren/entsperren (nur Kastellan)
router.patch('/:id/toggle-status', kastellanMiddleware, async (req, res) => {
    try {
        const mitarbeiter = await Mitarbeiter.findById(req.params.id);
        
        if (!mitarbeiter) {
            return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
        }

        mitarbeiter.aktiv = !mitarbeiter.aktiv;
        await mitarbeiter.save();

        res.json({ 
            message: `Mitarbeiter erfolgreich ${mitarbeiter.aktiv ? 'entsperrt' : 'gesperrt'}`,
            status: mitarbeiter.aktiv
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Eigenes Profil anzeigen (für eingeloggte Mitarbeiter)
router.get('/profil', async (req, res) => {
    try {
        const mitarbeiter = await Mitarbeiter.findById(req.session.user._id)
            .select('-password');

        if (!mitarbeiter) {
            return res.status(404).render('error', { 
                error: 'Profil nicht gefunden' 
            });
        }

        res.render('mitarbeiter/profil', {
            mitarbeiter,
            user: req.session.user
        });
    } catch (error) {
        res.status(500).render('error', { error });
    }
});

// Eigenes Passwort ändern (für eingeloggte Mitarbeiter)
router.post('/change-password', async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const mitarbeiter = await Mitarbeiter.findById(req.session.user._id);

        if (!mitarbeiter) {
            return res.status(404).json({ error: 'Mitarbeiter nicht gefunden' });
        }

        // Aktuelles Passwort überprüfen
        const isValid = await mitarbeiter.vergleichePassword(currentPassword);
        if (!isValid) {
            return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
        }

        mitarbeiter.password = newPassword; // wird durch Schema-Middleware gehasht
        await mitarbeiter.save();

        res.json({ message: 'Passwort erfolgreich geändert' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
