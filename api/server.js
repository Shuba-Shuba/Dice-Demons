const express = require('express');
const app = express();
const path = require('path');
const PORT = 8080;

// static files (frontend)
app.use('/',express.static(path.join(__dirname, '../frontend')));

// everything below is for API (backend)

app.use(express.json());

// chat
var messages = [];

app.get('/chat', (req, res) => {
  res.send(messages);
});

app.post('/chat', (req, res) => {
  const {msg} = req.body;
  messages.push(msg);
  res.status(200).send(msg);
});

app.listen(PORT, (error) => {
  if(!error) console.log(`Server listening on port ${PORT}`);
  else console.log("Error starting server: ",error);
});