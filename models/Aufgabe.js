const mongoose = require('mongoose');

const aufgabeSchema = new mongoose.Schema({
    titel: {
        type: String,
        required: true
    },
    beschreibung: {
        type: String,
        required: true
    },
    kategorie: {
        type: String,
        enum: ['allgemein', 'lift', 'garten', 'reinigung', 'reparatur'],
        required: true
    },
    prioritaet: {
        type: String,
        enum: ['hoch', 'mittel', 'niedrig'],
        required: true
    },
    status: {
        type: String,
        enum: ['neu', 'begonnen', 'abgeschlossen', 'verschoben'],
        default: 'neu'
    },
    zugewiesenAn: {
        type: String,
        default: 'hausmeister'
    },
    terminBis: {
        type: Date,
        required: true
    },
    erstelltAm: {
        type: Date,
        default: Date.now
    },
    erstelltVon: {
        type: String,
        required: true
    },
    begonnenAm: Date,
    abgeschlossenAm: Date,
    // Spezifisch für Lift-Wartungen
    liftWartung: {
        art: {
            type: String,
            enum: ['schmierung', 'reinigung_kabine', 'reinigung_raum', 'reparatur']
        },
        materialien: [{
            name: String,
            menge: Number,
            einheit: String
        }]
    },
    anmerkungen: [{ 
        text: String, 
        datum: { 
            type: Date, 
            default: Date.now 
        },
        autor: String
    }]
});

// Index für effiziente Abfragen
aufgabeSchema.index({ status: 1, terminBis: 1 });
aufgabeSchema.index({ kategorie: 1, status: 1 });

// Methode zur Überprüfung überfälliger Aufgaben
aufgabeSchema.statics.findeUeberfaelligeAufgaben = async function() {
    return await this.find({
        status: { $nin: ['abgeschlossen'] },
        terminBis: { $lt: new Date() }
    }).sort({ terminBis: 1 });
};

// Methode zur Statusaktualisierung
aufgabeSchema.methods.aktualisiereStatus = async function(neuerStatus, anmerkung) {
    const jetzt = new Date();
    
    switch(neuerStatus) {
        case 'begonnen':
            this.begonnenAm = jetzt;
            break;
        case 'abgeschlossen':
            this.abgeschlossenAm = jetzt;
            break;
    }
    
    this.status = neuerStatus;
    
    if (anmerkung) {
        this.anmerkungen.push({
            text: anmerkung,
            datum: jetzt,
            autor: this.zugewiesenAn
        });
    }
    
    return await this.save();
};

module.exports = mongoose.model('Aufgabe', aufgabeSchema);
