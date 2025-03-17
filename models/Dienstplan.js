const mongoose = require('mongoose');

const dienstplanSchema = new mongoose.Schema({
    datum: { 
        type: Date, 
        required: true 
    },
    position: { 
        type: String, 
        enum: ['shop_eingang', 'shop', 'museum', 'kasse_eingang', 'fuehrung'], 
        required: true 
    },
    mitarbeiter: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Mitarbeiter', 
        required: true 
    },
    status: {
        type: String,
        enum: ['vorgeschlagen', 'bestaetigt'],
        default: function() {
            // Führungen müssen vom Burgvogt bestätigt werden
            return this.position === 'fuehrung' ? 'vorgeschlagen' : 'bestaetigt';
        }
    }
});

// Prüfen, ob der Shop-Eingang besetzt ist
dienstplanSchema.statics.pruefeShopEingangBesetzung = async function(datum) {
    const start = new Date(datum);
    start.setHours(0, 0, 0, 0);
    const ende = new Date(datum);
    ende.setHours(23, 59, 59, 999);

    const shopEingangSchicht = await this.findOne({
        datum: { $gte: start, $lte: ende },
        position: 'shop_eingang',
        status: 'bestaetigt'
    });

    return !!shopEingangSchicht;
};

// Prüfen, ob ein Mitarbeiter bereits an diesem Tag eingeteilt ist
dienstplanSchema.statics.pruefeMitarbeiterVerfuegbar = async function(datum, mitarbeiterId) {
    const start = new Date(datum);
    start.setHours(0, 0, 0, 0);
    const ende = new Date(datum);
    ende.setHours(23, 59, 59, 999);

    const existierendeSchicht = await this.findOne({
        datum: { $gte: start, $lte: ende },
        mitarbeiter: mitarbeiterId
    });

    return !existierendeSchicht;
};

// Prüfen, ob das Datum in der Saison liegt (1. April bis 1. November)
dienstplanSchema.statics.pruefeIstInSaison = function(datum) {
    const d = new Date(datum);
    const monat = d.getMonth() + 1;
    const tag = d.getDate();
    
    if (monat < 4 || monat > 11) return false;
    if (monat === 4 && tag < 1) return false;
    if (monat === 11 && tag > 1) return false;
    
    return true;
};

const Dienstplan = mongoose.model('Dienstplan', dienstplanSchema);

module.exports = Dienstplan;
