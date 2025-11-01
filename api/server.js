const express = require('express');
const app = express();
const path = require('path');
const PORT = 8080;

// static files (frontend)
app.use('/',express.static(path.join(__dirname, '../frontend')));

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
})