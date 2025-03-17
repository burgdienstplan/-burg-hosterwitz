const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const mitarbeiterSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    benutzername: {
        type: String,
        required: true,
        unique: true
    },
    passwort: {
        type: String,
        required: true
    },
    rolle: {
        type: String,
        enum: ['burgvogt', 'burgmeister', 'museumsführer', 'shop_mitarbeiter'],
        required: true,
        default: 'shop_mitarbeiter'
    },
    aktiv: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Passwort verschlüsseln vor dem Speichern
mitarbeiterSchema.pre('save', async function(next) {
    if (!this.isModified('passwort')) return next();
    this.passwort = await bcrypt.hash(this.passwort, 10);
    next();
});

// Passwort-Vergleich Methode
mitarbeiterSchema.methods.pruefePasswort = async function(passwort) {
    return await bcrypt.compare(passwort, this.passwort);
};

const Mitarbeiter = mongoose.model('Mitarbeiter', mitarbeiterSchema);

module.exports = Mitarbeiter;
