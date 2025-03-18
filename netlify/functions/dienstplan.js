const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// CORS Headers
const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// MongoDB Atlas Verbindung
const connectDB = async () => {
  try {
    if (mongoose.connection.readyState === 1) return;
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    console.log('MongoDB Atlas verbunden');
  } catch (error) {
    console.error('MongoDB Verbindungsfehler:', error);
    throw error;
  }
};

// Authentifizierung prüfen
const checkAuth = (event) => {
  try {
    const token = event.headers.authorization?.split(' ')[1];
    if (!token) throw new Error('Kein Token vorhanden');
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded;
  } catch (error) {
    throw new Error('Ungültiger Token');
  }
};

// Dienstplan Schema
const dienstplanSchema = new mongoose.Schema({
  datum: Date,
  schicht: String,
  mitarbeiter: String,
  aufgaben: [String],
  status: {
    type: String,
    enum: ['geplant', 'aktiv', 'abgeschlossen'],
    default: 'geplant'
  },
  notizen: String,
  createdBy: String,
  updatedBy: String
}, {
  timestamps: true
});

const Dienstplan = mongoose.models.Dienstplan || mongoose.model('Dienstplan', dienstplanSchema);

exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 204,
      headers
    };
  }

  try {
    // Authentifizierung prüfen
    const user = checkAuth(event);
    await connectDB();

    switch (event.httpMethod) {
      case 'GET':
        // Liste aller Dienste oder einen spezifischen Dienst abrufen
        const dienste = await Dienstplan.find({});
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(dienste)
        };

      case 'POST':
        // Neuen Dienst erstellen
        const dienstData = JSON.parse(event.body);
        dienstData.createdBy = user.username;
        dienstData.updatedBy = user.username;
        
        const neuerDienst = await Dienstplan.create(dienstData);
        return {
          statusCode: 201,
          headers,
          body: JSON.stringify(neuerDienst)
        };

      case 'PUT':
        // Dienst aktualisieren
        const updateData = JSON.parse(event.body);
        const dienstId = event.path.split('/').pop();
        updateData.updatedBy = user.username;
        
        const aktualisierterDienst = await Dienstplan.findByIdAndUpdate(
          dienstId,
          updateData,
          { new: true }
        );
        
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify(aktualisierterDienst)
        };

      case 'DELETE':
        // Dienst löschen
        const deleteId = event.path.split('/').pop();
        await Dienstplan.findByIdAndDelete(deleteId);
        
        return {
          statusCode: 204,
          headers
        };

      default:
        return {
          statusCode: 405,
          headers,
          body: JSON.stringify({ message: 'Methode nicht erlaubt' })
        };
    }
  } catch (error) {
    console.error('Dienstplan-Fehler:', error);
    
    if (error.message === 'Ungültiger Token') {
      return {
        statusCode: 401,
        headers,
        body: JSON.stringify({ message: 'Nicht autorisiert' })
      };
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        message: 'Serverfehler bei der Dienstplan-Verwaltung',
        error: error.message
      })
    };
  }
};
