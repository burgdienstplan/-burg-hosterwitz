const express = require('express');
const router = express.Router();

// Middleware für Authentifizierung
const authMiddleware = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Lift-Status Route
router.get('/status', authMiddleware, (req, res) => {
    res.render('aufgaben/lift', {
        user: req.session.user
    });
});

// Lift-Steuerung Route
router.post('/control', authMiddleware, (req, res) => {
    const { action } = req.body;
    // Hier später: Lift-Steuerungslogik implementieren
    res.json({ success: true, message: 'Aktion ausgeführt' });
});

module.exports = router;
