const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const {parse} = require('cookie');
const crypto = require('crypto')

const app = express();
const server = http.createServer(app);
const io = new socketIO.Server(server);
const PORT = 80;


// static files (frontend)
const path = require('path');
// path to frontend folder
app.use('/',express.static(path.join(__dirname,'../frontend')));
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname,'/socket.io/socket.io.js'));
});


// io.emit -> everyone on server
// socket.emit -> specific client

const connectedClients = {};

io.on('connection', (socket) => {
  const cookie = getCookies(socket);

  if(!connectedClients[cookie.id]){
    // first connection
    connectedClients[cookie.id] = {
      username: cookie.username
    };
    socket.broadcast.emit('newMessage', {
      from: 'Server',
      text: `${cookie.username} joined`,
      createdAt: Date.now()
    });
  } else {
    // reconnection
    socket.broadcast.emit('newMessage', {
      from: 'Server',
      text: `${cookie.username} opened a second tab or smth`,
      createdAt: Date.now()
    });
  }
  console.log(connectedClients);


  socket.on('disconnect', () => {
    const cookie = getCookies(socket);
    socket.broadcast.emit('newMessage', {
      from: 'Server',
      text: `${cookie.username} disconnected`,
      createdAt: Date.now()
    });
    delete connectedClients[cookie.id];
    console.log(connectedClients);
  });
  
  socket.on('createMessage', (message) => {
    const cookie = getCookies(socket);
    // force reconnect if invalid data
    if(!connectedClients[cookie.id]){
      socket.io.engine.close();
      console.error('Received createMessage request for invalid ID, forced reconnect');
      return;
    }
    io.emit('newMessage', {
      from: connectedClients[cookie.id].username,
      text: message.text,
      createdAt: message.createdAt
    });
  });

  socket.on('setUsername', (username) => {
    const cookie = getCookies(socket);
    // force reconnect if invalid data
    if(!connectedClients[cookie.id]){
      socket.io.engine.close();
      console.error('Received setUsername request for invalid ID, forced reconnect');
      return;
    }
    socket.broadcast.emit('newMessage', {
      from: 'Server',
      text: `${connectedClients[cookie.id].username} changed their username to ${username}`,
      createdAt: Date.now()
    });
    connectedClients[cookie.id].username = username;
    console.log(connectedClients);
  });
});

server.listen(PORT, (error) => {
  if(!error) console.log(`Server listening on port ${PORT}`);
  else console.log("Error starting server: ",error);
});


// returns random 128-bit stringified int
function generateID() {
  var id_nums = crypto.getRandomValues(new Uint32Array(4));
  var id = "";
  for(num in id_nums){
    id += id_nums[num];
  }
  //console.log(id);
  return id;
}


// reads cookies and returns object with relevant properties,
// uses default values when cookie unavailable
function getCookies(socket) {
  var cookieObj = {
    id: null,
    username: "unnamed"
  };
  if(socket.handshake.headers.cookie && socket.handshake.headers.cookie.length > 0){
    let cookie = parse(socket.handshake.headers.cookie);
    if(cookie.id) cookieObj.id = cookie.id
    if(cookie.username) cookieObj.username = cookie.username
  }
  if(cookieObj.id == null) {
    // if client doesn't have a cookie, assign a new ID
    let id = generateID();
    socket.emit('generateID', id);
    cookieObj.id = id;
  }

  //console.log("cookie obj:",cookieObj);
  return cookieObj;
}