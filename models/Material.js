const mongoose = require('mongoose');

const materialSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    kategorie: {
        type: String,
        enum: ['lift', 'reinigung', 'werkzeug', 'ersatzteile'],
        required: true
    },
    bestand: {
        type: Number,
        required: true,
        min: 0
    },
    einheit: {
        type: String,
        required: true
    },
    mindestBestand: {
        type: Number,
        required: true,
        min: 0
    },
    bild: {
        dateiname: String,
        pfad: String,
        hochgeladenAm: Date
    },
    beschreibung: String,
    lagerort: {
        type: String,
        required: true
    },
    letzteBewegung: {
        type: Date,
        default: Date.now
    },
    bewegungen: [{
        datum: {
            type: Date,
            default: Date.now
        },
        art: {
            type: String,
            enum: ['eingang', 'ausgang'],
            required: true
        },
        menge: {
            type: Number,
            required: true
        },
        grund: String,
        bearbeiter: String
    }]
});

// Index für effiziente Abfragen
materialSchema.index({ kategorie: 1, name: 1 });
materialSchema.index({ bestand: 1 });

// Methode zur Bestandsänderung
materialSchema.methods.bestandAendern = async function(menge, art, grund, bearbeiter) {
    const aenderung = {
        datum: new Date(),
        art: art,
        menge: Math.abs(menge),
        grund: grund,
        bearbeiter: bearbeiter
    };

    if (art === 'ausgang') {
        if (this.bestand < menge) {
            throw new Error('Nicht genügend Bestand verfügbar');
        }
        this.bestand -= menge;
    } else {
        this.bestand += menge;
    }

    this.bewegungen.push(aenderung);
    this.letzteBewegung = aenderung.datum;
    
    return await this.save();
};

// Methode zur Prüfung von niedrigem Bestand
materialSchema.methods.pruefeNiedrigenBestand = function() {
    return this.bestand <= this.mindestBestand;
};

// Statische Methode zum Finden aller Materialien mit niedrigem Bestand
materialSchema.statics.findeMaterialienMitNiedrigemBestand = async function() {
    return await this.find({
        $expr: {
            $lte: ['$bestand', '$mindestBestand']
        }
    });
};

module.exports = mongoose.model('Material', materialSchema);
