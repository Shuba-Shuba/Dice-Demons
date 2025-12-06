const express = require('express');
const https = require('https');
const fs = require('fs');
const socketIO = require('socket.io');
const {parse} = require('cookie');
const crypto = require('crypto');
const path = require('path');

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
      players: this.players.map(player => player.username)
    }
  }

  removePlayer(id) {
    this.players.splice(this.players.findIndex(player => id === player.id),1);
  }

  getPlayer(id) {
    return this.players.find(player => player.id === id);
  }

  addPlayer(player) {
    this.players.push(player);
  }
}

class Player {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.tabs = 1;
  }
  
  isInAGame(games) {
    for(let i=0; i<games.length; i++) if(games[i].getPlayer(this. id)) return true;
    return false;
  }
}

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
const games = [];
const words = JSON.parse(fs.readFileSync("words.json", "utf-8"));

io.on('connection', (socket) => {
  // connection setup
  const data = getCookies(socket);
  const player = getPlayer(data);
  // if they edit their cookie while offline, use their data
  player.username = data.username;

  socket.data.player = player;

  if(!connectedClients[player.id]){
    // first tab
    connectedClients[player.id] = player;
    player.tabs = 1;
    socket.broadcast.emit('serverMessage', {
      text: `${player.username} joined`,
      createdAt: Date.now()
    });
  } else {
    // extra tab
    socket.broadcast.emit('serverMessage', {
      text: `${player.username} opened an extra tab`,
      createdAt: Date.now()
    });
    connectedClients[player.id].tabs += 1;
  }
  // console.log(connectedClients);

  // connection handlers
  socket.on('disconnect', () => {
    connectedClients[socket.data.player.id].tabs -= 1;
    if(connectedClients[socket.data.player.id].tabs === 0){
      socket.broadcast.emit('serverMessage', {
        text: `${player.username} disconnected`,
        createdAt: Date.now()
      });
      delete connectedClients[socket.data.player.id];
      // console.log(connectedClients);
    } else {
      socket.broadcast.emit('serverMessage', {
        text: `${socket.data.player.username} closed an extra tab`,
        createdAt: Date.now()
      });
      // console.log(connectedClients);
    }
  });

  // lobby handlers
  socket.on('createGame', () => {
    if(socket.data.player.isInAGame(games)) return errorAlreadyInGame(socket);

    const game = new Game(generateGameName());
    socket.emit('serverMessage', {text: `Created game "${game.name}"`});
    games.push(game);
    game.addPlayer(socket.data.player);
    // console.log(game);
  });
  socket.on('joinGame', (gameName) => {
    if(socket.data.player.isInAGame(games)) return errorAlreadyInGame(socket);

    const game = games.find(game => game.name === gameName);
    game.addPlayer(socket.data.player);
    socket.join(gameName);
    socket.emit('joinedGame', gameName);
  });
  socket.on('getGames', () => {
    socket.emit('getGames', games.map(game => game.lobbyData));
  });
  
  // chat handlers
  socket.on('createMessage', (message) => {
    if(!connectedClients[socket.data.player.id]) return errorInvalidID(socket, 'createMessage');
    
    io.emit('chatMessage', {
      from: socket.data.player.username,
      text: message.text,
      createdAt: message.createdAt
    });
  });

  socket.on('setUsername', (username) => {
    if(!connectedClients[socket.data.player.id]) return errorInvalidID(socket, 'setUsername');
    
    socket.broadcast.emit('serverMessage', {
      text: `${connectedClients[socket.data.player.id].username} changed their username to ${username}`,
      createdAt: Date.now()
    });
    connectedClients[socket.data.player.id].username = username;
    socket.data.player.username = username;
    // console.log(connectedClients);
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


// hopefully these never run
function errorInvalidID(socket, request) {
  console.error(`Received ${request} request for invalid ID`);
  socket.emit('error', {text: "Invalid ID"});
}
function errorAlreadyInGame(socket) {
  console.error(`Player "${socket.data.player.username}" (ID ${socket.data.player.id}) tried to join/create a game while already in a game`);
  socket.emit('error', {text: "Cannot join or create a game while already in a game"});
}


// returns random unique game name
function generateGameName() {
  // get 3 random words: adjective noun verb+ers
  const name = words.adjectives[Math.floor(Math.random()*words.adjectives.length)] + " " + words.things[Math.floor(Math.random()*words.things.length)] + " " + words.doers[Math.floor(Math.random()*words.doers.length)];
  
  // do not repeat
  if(games.find(game => game.name === name)){
    // count up if all names exhausted
    if(words.doers.length * words.things.length * words.adjectives.length <= games.length){
      console.error('GAME NAMES EXHAUSTED');
      return "Game #" + games.length;
    }
    return generateGameName();
  }
  return name;
}


// looks through connectedClients and games to find existing player with given ID, otherwise returns new player object
function getPlayer(data) {
  const id = data.id;
  if(connectedClients[id]) return connectedClients[id];
  for(let i=0; i<games.length; i++){
    const p = games[i].getPlayer(id);
    if(p){
      console.log(`found player in ${games[i].name}`);
      return p;
    }
  }
  console.log("didn't find existing player object");
  return new Player(data);
}