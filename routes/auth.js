const express = require('express');
const router = express.Router();
const Mitarbeiter = require('../models/Mitarbeiter');

// Login-Seite anzeigen
router.get('/login', (req, res) => {
    res.render('auth/login', {
        title: 'Willkommen in der Burg Hosterwitz',
        error: req.flash('error')
    });
});

// Login verarbeiten
router.post('/login', async (req, res) => {
    try {
        const { benutzername, passwort } = req.body;
        const mitarbeiter = await Mitarbeiter.findOne({ benutzername });

        if (!mitarbeiter || !(await mitarbeiter.pruefePasswort(passwort))) {
            req.flash('error', 'Ungültige Zugangsdaten zur Burg');
            return res.redirect('/auth/login');
        }

        req.session.user = {
            id: mitarbeiter._id,
            name: mitarbeiter.name,
            rolle: mitarbeiter.rolle
        };

        res.redirect('/dienstplan');
    } catch (error) {
        console.error('Fehler beim Betreten der Burg:', error);
        req.flash('error', 'Ein Fehler ist aufgetreten');
        res.redirect('/auth/login');
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/auth/login');
});

module.exports = router;
