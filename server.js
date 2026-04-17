require('dotenv').config();
const express = require('express');
const path = require('path');
const mongoose = require('mongoose');
const userRoutes = require("./Router/UserRouter");
const messageRoutes = require("./Router/MessageRouter");

const app = express();

app.use('/pub', express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use("/api", userRoutes);
app.use("/api", messageRoutes);

mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connecté à MongoDB Atlas ✅");
    const port = process.env.PORT || 3000;
    app.listen(port, () => console.log(`Serveur lancé sur http://localhost:${port}`));
  })
  .catch(err => {
    console.error("Erreur de connexion MongoDB ❌", err);
    process.exit(1);
  });