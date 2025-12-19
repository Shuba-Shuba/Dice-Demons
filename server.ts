import express, {Request, Response} from 'express';
import https from 'https';
import fs from 'fs';
import {Server, Socket} from 'socket.io';
import {parse} from 'cookie';
import crypto from 'crypto';
import path from 'path';
//#region Interfaces
interface ServerToClientEvents {
  // server
  generateID: (id: string, username: string) => void;

  // chat
  serverMessage: (msg: Message) => void;
  chatMessage: (msg: Message) => void;

  // game
  rollDice: (rolls: number[]) => void;
}

interface ClientToServerEvents {
  // lobby
  createGame: (callback: (response: {success: boolean, game?: GameLobbyData, reason?: string}) => void) => void;
  joinGame: (gameName: string, callback: (response: {success: boolean, game?: GameLobbyData, reason?: string}) => void) => void;
  getGames: (callback: (games: GameLobbyData[]) => void) => void;
  leaveGame: (callback: (response: {success: boolean, reason?: string}) => void) => void;

  // chat
  chatMessage: (msg: Message) => void;
  setUsername: (username: string, callback: (response: {success: boolean, reason?: string}) => void) => void;

  // game
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
//#endregion

//#region Classes
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

  removePlayer(id: string): void {
    const i = this.players.findIndex(player => id === player.id);
    if(i===-1) return;
    this.players[i].currentGame = undefined;
    this.players.splice(i,1);

    // this method should call a function to destroy this game if there's no players now
  }

  getPlayer(id: string): Player | undefined {
    return this.players.find(player => player.id === id);
  }

  addPlayer(player: Player): void {
    this.players.push(player);
    player.currentGame = this;
  }
}

class Player {
  id: string;
  username: string;
  tabs: number;
  currentGame?: Game;

  constructor(data: CookieData) {
    this.id = data.id;
    this.username = data.username;
    this.tabs = 1;
  }
}
//#endregion

//#region Setup
const domain = 'shubashuba.com';
const appUnsecured = express();
// redirect every single incoming http request to https
appUnsecured.use(function(req: Request, res: Response) {
  res.redirect(301, 'https://' + domain + req.originalUrl);
});
appUnsecured.listen(80);

const app = express();
const options = {
  key: fs.readFileSync('privkey.pem'),
  cert: fs.readFileSync('fullchain.pem'),
};
const server = https.createServer(options, app);
const io = new Server<
  ClientToServerEvents,
  ServerToClientEvents,
  {},
  SocketData
>(server);
const PORT = 443;
//#endregion

//#region Server
// frontend
app.use(express.static(path.join(__dirname,'public')));

// io.emit -> everyone on server
// socket.emit -> specific client

const connectedClients: {
  [id: string]: Player
} = {};
const games: Game[] = [];
const words: {
  adjectives: string[];
  things: string[];
  doers: string[];
} = JSON.parse(fs.readFileSync('words.json', 'utf-8'));

io.on('connection', (socket) => {
  //#region connection setup
  const data = getCookies(socket);
  const {player, status} = getPlayer(data);
  // if they edit their username while offline, use their data
  player.username = data.username;

  socket.data.player = player;

  switch(status){
    case 'extra tab':
      socket.broadcast.emit('serverMessage', {
        text: `${player.username} opened an extra tab`,
        createdAt: Date.now()
      });
      player.tabs += 1;
      break;
    case 'reconnect':
      connectedClients[player.id] = player;
      player.tabs = 1;
      socket.broadcast.emit('serverMessage', {
        text: `${player.username} reconnected`,
        createdAt: Date.now()
      });
      break;
    default:
      connectedClients[player.id] = player;
      socket.broadcast.emit('serverMessage', {
        text: `${player.username} joined`,
        createdAt: Date.now()
      });
  }

  socket.on('disconnect', () => {
    socket.data.player.tabs -= 1;
    if(socket.data.player.tabs === 0){
      socket.broadcast.emit('serverMessage', {
        text: `${player.username} disconnected`,
        createdAt: Date.now()
      });
      delete connectedClients[socket.data.player.id];
    } else {
      socket.broadcast.emit('serverMessage', {
        text: `${socket.data.player.username} closed an extra tab`,
        createdAt: Date.now()
      });
    }
  });
  //#endregion

  //#region lobby handlers
  socket.on('createGame', (callback) => {
    const player = socket.data.player;
    if(player.currentGame){
      callback({success: false, reason: "You're already in a game!"});
      return console.error(`Player "${player.username}" (ID ${player.id}) tried to create a game while already in a game`);
    }

    const game = new Game(generateGameName());
    games.push(game);

    game.addPlayer(player);
    socket.join(game.name);
    callback({success: true, game: game.lobbyData});
  });
  socket.on('joinGame', (gameName, callback) => {
    const player = socket.data.player;
    if(player.currentGame){
      callback({success: false, reason: "You're already in a game!"});
      return console.error(`Player "${player.username}" (ID ${player.id}) tried to join a game while already in a game`);
    }
    
    const game = games.find(game => game.name === gameName);
    if(game === undefined) {
      callback({success: false, reason: 'This game no longer exists!'});
      return console.error(`Player "${player.username}" (ID ${player.id}) tried to join a game that no longer exists`);
    }
    if(game.started) {
      callback({success: false, reason: 'This game has already started!'});
      return console.error(`Player "${player.username}" (ID ${player.id}) tried to join a game that already started`);
    }

    game.addPlayer(player);
    socket.join(gameName);
    callback({success: true, game: game.lobbyData});
  });
  socket.on('leaveGame', (callback) => {
    const player = socket.data.player;
    const game = player.currentGame;
    if(!game){
      callback({success: false, reason: "You're already not in a game!"});
      return console.error(`Player "${player.username}" (ID ${player.id}) tried to leave game but is already not in a game`);
    }

    socket.leave(game.name);
    game.removePlayer(player.id);
    callback({success: true});
  });
  socket.on('getGames', (callback) => {
    callback(games.map(game => game.lobbyData));
  });
  //#endregion
  
  //#region chat handlers
  socket.on('chatMessage', (message) => {
    if(!connectedClients[socket.data.player.id]) return errorInvalidID(socket, 'createMessage');

    io.emit('chatMessage', {
      from: socket.data.player.username,
      text: message.text,
      createdAt: message.createdAt
    });
  });

  socket.on('setUsername', (username, callback) => {
    if(!connectedClients[socket.data.player.id]){
      callback({success: false, reason: 'Invalid user ID'});
      return errorInvalidID(socket, 'setUsername');
    }

    callback({success: true});
    socket.broadcast.emit('serverMessage', {
      text: `${socket.data.player.username} changed their username to ${username}`,
      createdAt: Date.now()
    });

    socket.data.player.username = username;
  });
  //#endregion

  //#region game handlers
  socket.on('rollDice', () => {
    const game = socket.data.player.currentGame;
    if(!game) return;

    const rolls: number[] = [];
    for(let i=0; i<3; i++) rolls.push(Math.floor(Math.random()*6) + 1);
    rolls.sort((a,b) => b-a);

    io.to(game.name).emit('rollDice', rolls);
  });
  //#endregion
});

server.listen(PORT, () => {
  console.log('Server listening on port',PORT);
});
//#endregion

//#region Connections & Lobby
// reads cookies and returns object with relevant properties,
// uses default values when cookie unavailable
function getCookies(socket: Socket): CookieData {
  var cookieObj: {
    id: string; 
    username: string;
  } = {
    id: '',
    username: 'unnamed' + Math.floor(Math.random()*1000)
  };
  if(socket.handshake.headers.cookie && socket.handshake.headers.cookie.length > 0){
    let cookie = parse(socket.handshake.headers.cookie);
    if(cookie.id) cookieObj.id = cookie.id;
    if(cookie.username) cookieObj.username = cookie.username;
  }
  if(cookieObj.id === '') {
    // if client doesn't have a cookie, assign a new ID
    const id = crypto.randomUUID();
    socket.emit('generateID', id, cookieObj.username);
    cookieObj.id = id;
  }
  return cookieObj;
}


// hopefully these never run
function errorInvalidID(socket: Socket, event: string): void {
  console.error(`Received ${event} event for invalid ID`);
  socket.emit('invalidID', event);
}


// returns random unique game name
function generateGameName(): string {
  // get 3 random words: adjective noun verb+ers
  const name = words.adjectives[Math.floor(Math.random()*words.adjectives.length)] + ' ' + words.things[Math.floor(Math.random()*words.things.length)] + ' ' + words.doers[Math.floor(Math.random()*words.doers.length)];
  
  // do not repeat
  if(games.find(game => game.name === name)){
    // count up if all names exhausted
    if(words.doers.length * words.things.length * words.adjectives.length <= games.length){
      console.error('GAME NAMES EXHAUSTED');
      return 'Game #' + games.length;
    }
    return generateGameName();
  }
  return name;
}


// looks through connectedClients and games to find existing player with given ID, otherwise returns new player object
function getPlayer(data: CookieData): {player: Player, status?: string} {
  const id = data.id;

  // already connected (extra tab)
  if(connectedClients[id]) return {player: connectedClients[id], status: 'extra tab'};

  // reconnecting to game
  for(let i=0; i<games.length; i++){
    const p = games[i].getPlayer(id);
    if(p) return {player: p, status: 'reconnect'};
  }

  // not in game
  return {player: new Player(data)};
}
//#endregion