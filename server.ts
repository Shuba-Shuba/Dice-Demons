import express, {Request, Response} from 'express';
import https from 'https';
import fs from 'fs';
import {Server, Socket} from 'socket.io';
import {parse} from 'cookie';
import crypto from 'crypto';
import path from 'path';

interface ServerToClientEvents {
  generateID: (id: string) => void;
  serverMessage: (msg: Message) => void;
  chatMessage: (msg: Message) => void;
  joinedGame: (game: GameLobbyData) => void;
  getGames: (games: GameLobbyData[]) => void;
  rollDice: (rolls: number[]) => void;
}

interface ClientToServerEvents {
  createGame: () => void;
  joinGame: (gameName: string) => void;
  getGames: () => void;
  createMessage: (msg: Message) => void;
  setUsername: (username: string) => void;
  rollDice: () => void;
}

interface SocketData {
  player: Player
}

interface Message {
  from?: string;
  text: string;
  createdAt?: number;
}

interface GameLobbyData {
  started: boolean;
  name: string;
  players: string[]; 
}

interface CookieData {
  id: string;
  username: string;
}

class Game {
  started: boolean;
  name: string;
  players: Player[];
  gameState: Object; // subject to change as implemented

  constructor(name: string) {
    this.started = false;
    this.name = name;
    this.players = [];
    this.gameState = {};
  }

  get lobbyData(): GameLobbyData {
    // only include data worth showing on lobby
    return {
      started: this.started,
      name: this.name,
      players: this.players.map(player => player.username)
    }
  }

  removePlayer(id: string) {
    this.players.splice(this.players.findIndex(player => id === player.id),1);
  }

  getPlayer(id: string) {
    return this.players.find(player => player.id === id);
  }

  addPlayer(player: Player) {
    this.players.push(player);
  }
}

class Player {
  id: string;
  username: string;
  tabs: number;

  constructor(data: CookieData) {
    this.id = data.id;
    this.username = data.username;
    this.tabs = 1;
  }
  
  isInAGame(games: Game[]) {
    for(let i=0; i<games.length; i++) if(games[i].getPlayer(this. id)) return true;
    return false;
  }
}

const domain = 'shubashuba.com';
const appUnsecured = express();
// redirect every single incoming http request to https
appUnsecured.use(function(req: Request, res: Response) {
  res.redirect(301, 'https://' + domain + req.originalUrl);
});
appUnsecured.listen(80);

const app = express();
const options = {
  key: fs.readFileSync("privkey.pem"),
  cert: fs.readFileSync("fullchain.pem"),
};
const server = https.createServer(options, app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>(server);
const PORT = 443;

// frontend
app.use(express.static(path.join(__dirname,'public')));


// io.emit -> everyone on server
// socket.emit -> specific client

const connectedClients: {
  [key: string]: Player
} = {};
const games: Game[] = [];
const words: {
  adjectives: string[];
  things: string[];
  doers: string[];
} = JSON.parse(fs.readFileSync("words.json", "utf-8"));

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
    socket.join(game.name);
    socket.emit('joinedGame', game.lobbyData);
  });
  socket.on('joinGame', (gameName) => {
    if(socket.data.player.isInAGame(games)) return errorAlreadyInGame(socket);
    
    const game = games.find(game => game.name === gameName);
    if(game === undefined) return; // note to self: make nonexistant game error handler

    game.addPlayer(socket.data.player);
    socket.join(gameName);
    socket.emit('joinedGame', game.lobbyData);
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
    const rolls: number[] = [];
    for(let i=0; i<3; i++) rolls.push(Math.floor(Math.random()*6) + 1);
    rolls.sort((a,b) => b-a);
    io.emit('rollDice', rolls);
  });
});

server.listen(PORT, () => {
  console.log('Server listening on port',PORT);
});


// reads cookies and returns object with relevant properties,
// uses default values when cookie unavailable
function getCookies(socket: Socket): CookieData {
  var cookieObj: {
    id: string; 
    username: string
  } = {
    id: "",
    username: "unnamed"
  };
  if(socket.handshake.headers.cookie && socket.handshake.headers.cookie.length > 0){
    let cookie = parse(socket.handshake.headers.cookie);
    if(cookie.id) cookieObj.id = cookie.id
    if(cookie.username) cookieObj.username = cookie.username
  }
  if(cookieObj.id === "") {
    // if client doesn't have a cookie, assign a new ID
    const id = crypto.randomUUID();
    socket.emit('generateID', id);
    cookieObj.id = id;
  }

  //console.log("cookie obj:",cookieObj);
  return cookieObj;
}


// hopefully these never run
function errorInvalidID(socket: Socket, event: string): void {
  console.error(`Received ${event} event for invalid ID`);
  socket.emit('error', {text: "Invalid ID"});
}
function errorAlreadyInGame(socket) {
  console.error(`Player "${socket.data.player.username}" (ID ${socket.data.player.id}) tried to join/create a game while already in a game`);
  socket.emit('error', {text: "Cannot join or create a game while already in a game"});
}


// returns random unique game name
function generateGameName(): string {
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
function getPlayer(data: CookieData): Player {
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