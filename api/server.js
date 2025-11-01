const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = 8080;


// static files (frontend)
const path = require('path');
app.use('/',express.static(path.join(__dirname, '../frontend')));


// everything below is for API (backend)

app.use(express.json());

// chat
var messages = [];

io.on('connection', (socket) => {
  console.log('New user connected');
  socket.emit('newMessage', {
    from: 'Server',
    text: 'Welcome!',
    createdAt: Date.now()
  });
  socket.on('createMessage', (message) => {
    console.log('New message: ', message);
    io.emit('newMessage', message);
  });
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

// app.get('/chat', (req, res) => {
//   res.send(messages);
// });

// app.post('/chat', (req, res) => {
//   const {msg} = req.body;
//   messages.push(msg);
//   res.status(200).send(msg);
// });

app.listen(PORT, (error) => {
  if(!error) console.log(`Server listening on port ${PORT}`);
  else console.log("Error starting server: ",error);
});