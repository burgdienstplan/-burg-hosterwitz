const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

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

// Benutzer Schema
const userSchema = new mongoose.Schema({
  username: String,
  password: String,
  role: String,
  displayName: String,
  lastLogin: Date
});

const User = mongoose.models.User || mongoose.model('User', userSchema);

// Login Handler
exports.handler = async (event, context) => {
  context.callbackWaitsForEmptyEventLoop = false;
  
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ message: 'Methode nicht erlaubt' })
    };
  }

  try {
    await connectDB();
    const { username, password } = JSON.parse(event.body);

    // Benutzer in der Datenbank suchen
    const user = await User.findOne({ username });

    if (!user || !bcrypt.compareSync(password, user.password)) {
      return {
        statusCode: 401,
        body: JSON.stringify({ message: 'Ungültige Anmeldedaten' })
      };
    }

    // Letztes Login-Datum aktualisieren
    user.lastLogin = new Date();
    await user.save();

    // JWT Token erstellen
    const token = jwt.sign(
      { 
        username: user.username, 
        role: user.role,
        displayName: user.displayName 
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    return {
      statusCode: 200,
      body: JSON.stringify({ 
        token, 
        user: {
          username: user.username,
          role: user.role,
          displayName: user.displayName,
          lastLogin: user.lastLogin
        }
      })
    };
  } catch (error) {
    console.error('Login-Fehler:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Serverfehler bei der Anmeldung' })
    };
  }
};
