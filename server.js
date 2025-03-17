require('dotenv').config();
const express = require('express');
const session = require('express-session');
const mongoose = require('mongoose');
const path = require('path');
const app = express();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');

// Session-Konfiguration
app.use(session({
    secret: process.env.SESSION_SECRET || 'geheim',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === 'production' }
}));

// Datenbank-Verbindung
mongoose.connect('mongodb://localhost:27017/burg_hosterwitz', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log('Die Burg öffnet ihre Tore! (Datenbankverbindung hergestellt)');
}).catch(err => {
    console.error('Die Burg bleibt verschlossen! (Datenbankfehler):', err);
});

// Test-Daten
const testAufgaben = [
    {
        _id: '1',
        titel: 'Lift-Wartung',
        beschreibung: 'Monatliche Wartung des Burglifts',
        kategorie: 'lift',
        prioritaet: 'hoch',
        status: 'neu',
        terminBis: new Date('2025-03-20'),
        zugewiesenAn: 'burgmeister',
        erstelltVon: 'burgvogt'
    },
    {
        _id: '2',
        titel: 'Burggarten pflegen',
        beschreibung: 'Frühjahrsarbeiten im Burggarten',
        kategorie: 'garten',
        prioritaet: 'mittel',
        status: 'neu',
        terminBis: new Date('2025-03-25'),
        zugewiesenAn: 'burgmeister',
        erstelltVon: 'burgvogt'
    }
];

const testMitarbeiter = [
    {
        _id: '1',
        name: 'Hans Burgwart',
        rolle: 'shop_eingang',
        aktiv: true
    },
    {
        _id: '2',
        name: 'Maria Schatzkammer',
        rolle: 'kasse_eingang',
        aktiv: true
    },
    {
        _id: '3',
        name: 'Peter Museumsführer',
        rolle: 'museum',
        aktiv: true
    }
];

const testSchichten = [
    {
        _id: '1',
        datum: new Date('2025-04-01'),
        position: 'shop_eingang',
        mitarbeiter: '1',
        schichtBeginn: '09:00',
        schichtEnde: '17:00',
        status: 'bestätigt'
    },
    {
        _id: '2',
        datum: new Date('2025-04-01'),
        position: 'museum',
        mitarbeiter: '3',
        schichtBeginn: '10:00',
        schichtEnde: '16:00',
        status: 'bestätigt'
    }
];

// Middleware für Authentifizierung
const authMiddleware = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

const kastellanMiddleware = (req, res, next) => {
    if (!req.session.user || req.session.user.role !== 'kastellan') {
        return res.status(403).render('error', {
            title: 'Zugriff verweigert',
            message: 'Nur der Burgvogt hat Zugang zu dieser Kammer.',
            error: {}
        });
    }
    next();
};

// Routen
const dienstplanRouter = require('./routes/dienstplan');
const authRouter = require('./routes/auth');

app.use('/dienstplan', dienstplanRouter);
app.use('/auth', authRouter);

// Hauptseite auf Login umleiten
app.get('/', (req, res) => {
    res.redirect('/auth/login');
});

// Auth-Routen
app.get('/login', (req, res) => {
    if (req.session.user) {
        if (req.session.user.role === 'kastellan') {
            return res.redirect('/kastellan/dashboard');
        } else if (req.session.user.role === 'hausmeister') {
            return res.redirect('/hausmeister/dashboard');
        }
    }
    res.render('login');
});

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        if (username === 'kastellan' && password === 'burg123') {
            req.session.user = { 
                username, 
                role: 'kastellan',
                displayName: 'Burgvogt',
                lastLogin: new Date()
            };
            return res.redirect('/kastellan/dashboard');
        } else if (username === 'hausmeister' && password === 'haus123') {
            req.session.user = { 
                username, 
                role: 'hausmeister',
                displayName: 'Burgmeister',
                lastLogin: new Date()
            };
            return res.redirect('/hausmeister/dashboard');
        }
        return res.render('login', { 
            error: 'Ungültige Anmeldedaten',
            username
        });
    } catch (error) {
        console.error('Login-Fehler:', error);
        return res.render('login', { 
            error: 'Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.',
            username
        });
    }
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});

// Dashboard-Routen
app.get('/kastellan/dashboard', kastellanMiddleware, (req, res) => {
    res.render('kastellan/dashboard', {
        user: req.session.user,
        offeneAufgaben: testAufgaben.filter(a => a.status === 'neu').length,
        liftStatus: 'aktiv'
    });
});

app.get('/hausmeister/dashboard', authMiddleware, (req, res) => {
    if (req.session.user.role !== 'hausmeister') {
        return res.redirect('/');
    }
    res.render('hausmeister/dashboard', { 
        user: req.session.user 
    });
});

// API-Routen
app.get('/api/aufgaben', kastellanMiddleware, (req, res) => {
    const { kategorie, status, prioritaet } = req.query;
    let aufgaben = [...testAufgaben];
    
    if (kategorie) {
        aufgaben = aufgaben.filter(a => a.kategorie === kategorie);
    }
    if (status) {
        aufgaben = aufgaben.filter(a => a.status === status);
    }
    if (prioritaet) {
        aufgaben = aufgaben.filter(a => a.prioritaet === prioritaet);
    }

    const ueberfaelligeAufgaben = aufgaben.filter(a => 
        a.status !== 'abgeschlossen' && 
        new Date(a.terminBis) < new Date()
    );
    
    if (req.headers.accept?.includes('application/json')) {
        res.json({
            aufgaben,
            success: true
        });
    } else {
        res.render('aufgaben/uebersicht', {
            user: req.session.user,
            aufgaben,
            ueberfaelligeAufgaben
        });
    }
});

app.get('/api/aufgaben/:id', kastellanMiddleware, (req, res) => {
    const aufgabe = testAufgaben.find(a => a._id === req.params.id);
    
    if (!aufgabe) {
        return res.status(404).render('error', {
            title: 'Aufgabe nicht gefunden',
            message: 'Diese Schriftrolle existiert nicht in der Burgbibliothek.',
            error: {}
        });
    }

    if (req.headers.accept?.includes('application/json')) {
        res.json({
            aufgabe,
            success: true
        });
    } else {
        res.render('aufgaben/details', {
            user: req.session.user,
            aufgabe
        });
    }
});

app.post('/api/aufgaben', kastellanMiddleware, (req, res) => {
    const { titel, beschreibung, kategorie, prioritaet, terminBis } = req.body;
    
    // Validierung
    if (!titel || !beschreibung || !kategorie || !prioritaet || !terminBis) {
        return res.status(400).render('error', {
            title: 'Unvollständige Aufgabe',
            message: 'Alle Felder der Schriftrolle müssen ausgefüllt sein.',
            error: {}
        });
    }

    const terminDate = new Date(terminBis);
    const heute = new Date();
    if (terminDate < heute) {
        return res.status(400).render('error', {
            title: 'Ungültiges Datum',
            message: 'Das Fälligkeitsdatum muss in der Zukunft liegen.',
            error: {}
        });
    }

    const neueAufgabe = {
        _id: Date.now().toString(),
        titel: titel.trim(),
        beschreibung: beschreibung.trim(),
        kategorie,
        prioritaet,
        status: 'neu',
        terminBis: terminDate,
        zugewiesenAn: 'burgmeister',
        erstelltVon: 'burgvogt',
        erstelltAm: new Date(),
        anmerkungen: []
    };

    testAufgaben.push(neueAufgabe);

    if (req.headers.accept?.includes('application/json')) {
        res.json({
            aufgabe: neueAufgabe,
            success: true
        });
    } else {
        res.redirect('/api/aufgaben');
    }
});

app.post('/api/aufgaben/:id/anmerkung', authMiddleware, (req, res) => {
    const aufgabe = testAufgaben.find(a => a._id === req.params.id);
    
    if (!aufgabe) {
        return res.status(404).render('error', {
            title: 'Aufgabe nicht gefunden',
            message: 'Diese Schriftrolle existiert nicht in der Burgbibliothek.',
            error: {}
        });
    }

    const anmerkung = {
        text: req.body.anmerkung,
        autor: req.session.user.role === 'kastellan' ? 'burgvogt' : 'burgmeister',
        datum: new Date()
    };

    if (!aufgabe.anmerkungen) {
        aufgabe.anmerkungen = [];
    }
    aufgabe.anmerkungen.push(anmerkung);

    res.redirect(`/api/aufgaben/${aufgabe._id}`);
});

app.post('/api/aufgaben/:id/status', authMiddleware, (req, res) => {
    const aufgabe = testAufgaben.find(a => a._id === req.params.id);
    
    if (!aufgabe) {
        return res.status(404).render('error', {
            title: 'Aufgabe nicht gefunden',
            message: 'Diese Schriftrolle existiert nicht in der Burgbibliothek.',
            error: {}
        });
    }

    if (req.session.user.role !== 'hausmeister' && aufgabe.zugewiesenAn !== 'burgmeister') {
        return res.status(403).render('error', {
            title: 'Zugriff verweigert',
            message: 'Nur der Burgmeister darf den Status dieser Aufgabe ändern.',
            error: {}
        });
    }

    const { status } = req.body;
    if (!['neu', 'begonnen', 'abgeschlossen', 'verschoben'].includes(status)) {
        return res.status(400).render('error', {
            title: 'Ungültiger Status',
            message: 'Dieser Status ist in der Burgordnung nicht vorgesehen.',
            error: {}
        });
    }

    aufgabe.status = status;
    res.redirect(`/api/aufgaben/${aufgabe._id}`);
});

app.get('/api/mitarbeiter', kastellanMiddleware, (req, res) => {
    res.json({
        mitarbeiter: testMitarbeiter,
        success: true
    });
});

app.get('/api/lift', kastellanMiddleware, (req, res) => {
    res.json({
        status: 'aktiv',
        letztePruefung: '2025-03-01',
        naechstePruefung: '2025-04-01',
        wartungen: [
            {
                datum: '2025-03-01',
                techniker: 'Hans Schmied',
                status: 'abgeschlossen'
            }
        ],
        success: true
    });
});

// Dienstplan-Routen
const dienstplanRouter = require('./routes/dienstplan');
app.use('/dienstplan', dienstplanRouter);

// Fehlerbehandlung
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).render('error', {
        title: 'Ein Fehler ist aufgetreten',
        message: 'Die Burg hat ein technisches Problem.',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// 404-Handler
app.use((req, res) => {
    res.status(404).render('error', {
        title: 'Seite nicht gefunden',
        message: 'Diese Burgkammer existiert nicht.',
        error: {}
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Die Burg ist geöffnet auf Port ${PORT}`);
});
