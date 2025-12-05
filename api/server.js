class Game {
  constructor(name) {
    this.started = false;
    this.name = String(name);
    this.players = [];
    this.gameState = {};
  }

  get lobbyData() {
    // only include data worth showing on lobby
    return {
      started: this.started,
      name: this.name,
      players: this.players,
    }
  }

  removePlayer(id) {
    for(let i=0; i<this.players.length; i++){
      if(this.players[i].id === id){
        this.players.splice(i,1);
        break;
      };
    }
  }

  getPlayer(id) {
    return this.players.find(player => player.id === id);
  }
}

class Player {
  constructor(username, id) {
    this.username = username;
    this.id = id;
  }
}

const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
const {parse} = require('cookie');
const crypto = require('crypto');

const domain = 'shubashuba.com';
const appUnsecured = express();
// redirect every single incoming http request to https
appUnsecured.use(function(req, res) {
  res.redirect(301, 'https://' + domain + req.originalUrl);
});
appUnsecured.listen(80);

const app = express();
const options = {
  key: fs.readFileSync("privkey.pem"),
  cert: fs.readFileSync("fullchain.pem"),
};
const server = https.createServer(options, app);
const io = new socketIO.Server(server);
const PORT = 443;

const pages = JSON.parse(fs.readFileSync("../frontend/pages.json", "utf-8"));
const path = require('path');

// frontend
// home page
app.use('/',express.static(path.join(__dirname,'../frontend')));
// socket.io script location is hardcoded
app.get('/socket.io/socket.io.js', (req, res) => {
  res.sendFile(path.join(__dirname,'/socket.io/socket.io.js'));
});
// fake subdirectories for page navigation
for(const page in pages){
  app.use(`/${pages[page].id}`,express.static(path.join(__dirname,'../frontend')));
}


// io.emit -> everyone on server
// socket.emit -> specific client

const connectedClients = {};
const gameRooms = [];
const words = JSON.parse(fs.readFileSync("words.json", "utf-8"));

io.on('connection', (socket) => {
  // connection setup
  socket.data = getCookies(socket);

  if(!connectedClients[socket.data.id]){
    // first connection
    connectedClients[socket.data.id] = {
      username: socket.data.username,
      tabs: 1
    };
    socket.broadcast.emit('serverMessage', {
      text: `${socket.data.username} joined`,
      createdAt: Date.now()
    });
  } else {
    // reconnection
    socket.broadcast.emit('serverMessage', {
      text: `${socket.data.username} opened an extra tab`,
      createdAt: Date.now()
    });
    connectedClients[socket.data.id].tabs += 1;
  }
  console.log(connectedClients);

  // connection handlers
  socket.on('disconnect', () => {
    connectedClients[socket.data.id].tabs -= 1;
    if(connectedClients[socket.data.id].tabs === 0){
      socket.broadcast.emit('serverMessage', {
        text: `${socket.data.username} disconnected`,
        createdAt: Date.now()
      });
      delete connectedClients[socket.data.id];
      console.log(connectedClients);
    } else {
      socket.broadcast.emit('serverMessage', {
        text: `${socket.data.username} closed an extra tab`,
        createdAt: Date.now()
      });
      console.log(connectedClients);
    }
  });

  // lobby handlers
  socket.on('createGame', () => {
    const game = new Game(generateGameName());
    socket.emit('createGame', generateGameName());
  });
  
  // chat handlers
  socket.on('createMessage', (message) => {
    if(!connectedClients[socket.data.id]) return invalidID('createMessage');
    
    io.emit('chatMessage', {
      from: socket.data.username,
      text: message.text,
      createdAt: message.createdAt
    });
  });

  socket.on('setUsername', (username) => {
    if(!connectedClients[socket.data.id]) return invalidID('setUsername');
    
    socket.broadcast.emit('serverMessage', {
      text: `${connectedClients[socket.data.id].username} changed their username to ${username}`,
      createdAt: Date.now()
    });
    connectedClients[socket.data.id].username = username;
    socket.data.username = username;
    console.log(connectedClients);
  });

  // game handlers
  socket.on('rollDice', () => {
    const rolls = [];
    for(let i=0; i<3; i++) rolls.push(Math.floor(Math.random()*6) + 1);
    rolls.sort((a,b) => b-a);
    io.emit('rollDice', rolls);
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


// hopefully this never runs
function invalidID(req) {
  console.error(`Received ${req} request for invalid ID`);
}


// returns 3 random words: adjective noun verb+ers
function generateGameName() {
  return words.adjectives[Math.floor(Math.random()*words.adjectives.length)] + " " + words.things[Math.floor(Math.random()*words.things.length)] + " " + words.doers[Math.floor(Math.random()*words.doers.length)];
}