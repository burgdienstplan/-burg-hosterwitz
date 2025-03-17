# Burg Hosterwitz Verwaltungssystem

Version: 25.1
Entwickelt von: Martin Steindorfer

## Installation

1. Node.js installieren
2. MongoDB installieren
3. Projektabhängigkeiten installieren:
```bash
npm install
```
4. `.env` Datei erstellen mit folgenden Variablen:
```
MONGODB_URI=mongodb://localhost:27017/burg_hosterwitz
SESSION_SECRET=IhrGeheimesPasswort
PORT=3000
```
5. Server starten:
```bash
npm start
```

## Features

- Dienstplanverwaltung (April - November)
- Mitarbeiterverwaltung
- Aufgabenverwaltung
- Lift-Wartungssystem
- Lagerverwaltung
