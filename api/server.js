const express = require('express');
const http = require('http');
const socketIO = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new socketIO.Server(server, {
  connectionStateRecovery: {
    maxDisconnectionDuration: 60*1000
  },
  cookie: true
});
const PORT = 80;


// static files (frontend)
const path = require('path');
const { connect } = require('http2');
// path to frontend folder
app.use('/',express.static(path.join(__dirname,'../frontend')));
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname,'/socket.io/socket.io.js'));
});


var connectedClients = [];

// io.emit -> everyone on server
// socket.emit -> specific client
io.on('connection', (socket) => {
  socket.once('disconnect', () => {
    connectedClients.splice(connectedClients.indexOf(socket.id),1);
    console.log(connectedClients);
    socket.broadcast.emit('newMessage', {
      from: 'Server',
      text: 'bro disconnected',
      createdAt: Date.now()
    });
  });
  connectedClients.push(socket.id);
  console.log(connectedClients);
  socket.broadcast.emit('newMessage', {
    from: 'Server',
    text: 'bro connected',
    createdAt: Date.now()
  });
  socket.on('createMessage', (message) => {
    io.emit('newMessage', message);
  });
});

server.listen(PORT, (error) => {
  if(!error) console.log(`Server listening on port ${PORT}`);
  else console.log("Error starting server: ",error);
});