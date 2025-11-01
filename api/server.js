const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);
const PORT = 8080;


// static files (frontend)
const path = require('path');
app.use('/',express.static(__dirname));

io.on('connection', (socket) => {
  console.log('New user connected');
  socket.emit('newMessage', {
    from: 'Server',
    text: 'bro connected',
    createdAt: Date.now()
  });
  socket.on('createMessage', (message) => {
    console.log('bro said ', message);
    io.emit('newMessage', message);
  });
  socket.on('disconnect', () => {
    console.log('bro disconnected');
  });
});

server.listen(PORT, (error) => {
  if(!error) console.log(`Server listening on port ${PORT}`);
  else console.log("Error starting server: ",error);
});