require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const Mitarbeiter = require('../models/Mitarbeiter');

// Verbinde mit der Datenbank
mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    try {
        // Prüfe ob Burgvogt bereits existiert
        const existingUser = await Mitarbeiter.findOne({ benutzername: 'burgvogt' });
        if (existingUser) {
            console.log('Der Burgvogt existiert bereits!');
            return;
        }

        // Erstelle den Burgvogt mit gehashtem Passwort
        const hashedPassword = bcrypt.hashSync('BurgHosterwitz2025!', 10);
        await Mitarbeiter.create({
            name: 'Burgvogt von Hosterwitz',
            benutzername: 'burgvogt',
            passwort: hashedPassword,
            rolle: 'burgvogt'
        });
        
        console.log('Der Burgvogt wurde erfolgreich ernannt!');
    } catch (error) {
        console.error('Fehler bei der Ernennung des Burgvogts:', error);
    } finally {
        mongoose.connection.close();
    }
});
