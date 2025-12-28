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
  status: (reconnected: boolean, game?: GameLobbyData) => void;
  oldTab: () => void;

  // lobby
  updateLobby: (game: GameLobbyData) => void;
  startGame: (game: GameLobbyData) => void;

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
  setReady: (ready: boolean, callback: (response: {success: boolean, reason?: string}) => void) => void;
  saveSettings: (boardSettings: Game['boardSettings'], callback: (response: {success: boolean, reason?: string}) => void) => void;

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
  players: PlayerLobbyData[];
  boardSettings: Game['boardSettings'];
}

interface PlayerLobbyData {
  username: string;
  ready?: boolean;
  host?: boolean;
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
  boardSettings: {
    width_spawn: number;
    width_land: number;
    width_bridge: number;
    spawn_spaces: number;
    spaces_per_bridge: number;
    rings: number;
  }
  gameState: Object; // subject to change as implemented

  constructor(name: string) {
    this.started = false;
    this.name = name;
    this.players = [];
    this.boardSettings = this.defaultBoardSettings;
    this.gameState = {};
  }

  get lobbyData(): GameLobbyData {
    // only include data worth showing on lobby
    return {
      started: this.started,
      name: this.name,
      players: this.players.map(player => player.lobbyData),
      boardSettings: this.boardSettings
    }
  }

  get defaultBoardSettings(): this['boardSettings'] {
    return {
      width_spawn: 100,
      width_land: 100,
      width_bridge: 100,
      spawn_spaces: 4,
      spaces_per_bridge: 8,
      rings: 2
    };
  }

  removePlayer(id: string): void {
    const i = this.players.findIndex(player => id === player.id);
    if(i===-1) return;
    this.players[i].currentGame = undefined;
    this.players.splice(i,1);

    // remove from games list if no more players
    if(this.players.length === 0) games.splice(games.indexOf(this),1);
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
  currentGame?: Game;

  // lobby data
  ready?: boolean;
  host?: boolean;

  constructor(data: CookieData) {
    this.id = data.id;
    this.username = data.username;
  }

  get lobbyData(): PlayerLobbyData {
    return {
      username: this.username,
      ready: this.ready,
      host: this.host
    }
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
  const {player, extraTab} = getPlayer(data);
  // if they edit their username while offline, use their data
  player.username = data.username;

  socket.data.player = player;

  if(extraTab) {
    disconnectOldTabs(socket, player);
  }
  if(player.currentGame) {
    connectedClients[player.id] = player;
    socket.broadcast.emit('serverMessage', {
      text: `${player.username} reconnected`,
      createdAt: Date.now()
    });
    const game = player.currentGame;
    player.ready = false;
    io.to(game.name).emit('updateLobby', game.lobbyData);
    socket.join(game.name);
  } else {
    connectedClients[player.id] = player;
    socket.broadcast.emit('serverMessage', {
      text: `${player.username} joined`,
      createdAt: Date.now()
    });
  }
  socket.emit('status', Boolean(player.currentGame), player.currentGame?.lobbyData);

  socket.on('disconnect', (reason) => {
    if(reason === 'server namespace disconnect') return;
    const player = socket.data.player;
    socket.broadcast.emit('serverMessage', {
      text: `${player.username} disconnected`,
      createdAt: Date.now()
    });
    delete connectedClients[player.id];
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

    player.ready = false;
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
    if(!game) {
      callback({success: false, reason: 'This game no longer exists!'});
      return console.error(`Player "${player.username}" (ID ${player.id}) tried to join a game that no longer exists`);
    }
    if(game.started) {
      callback({success: false, reason: 'This game has already started!'});
      return console.error(`Player "${player.username}" (ID ${player.id}) tried to join a game that already started`);
    }

    player.ready = false;
    game.addPlayer(player);
    io.to(gameName).emit('updateLobby', game.lobbyData);
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

    game.removePlayer(player.id);
    socket.leave(game.name);
    io.to(game.name).emit('updateLobby', game.lobbyData);
    callback({success: true});
  });
  socket.on('setReady', (ready, callback) => {
    const player = socket.data.player;
    const game = player.currentGame;
    if(!game) return callback({success: false, reason: 'Not in game'});
    if(game.started) return callback({success: false, reason: 'Game already started'});
    
    player.ready = ready;
    io.to(game.name).emit('updateLobby', game.lobbyData);
    callback({success: true});
    
    if(ready && !game.players.some(player => player.ready === false)) {
      game.started = true;
      io.to(game.name).emit('startGame', game.lobbyData);
    }
  });
  socket.on('saveSettings', (boardSettings, callback) => {
    const player = socket.data.player;
    const game = player.currentGame;
    if(!game) return callback({success: false, reason: 'Not in game'});
    if(game.started) return callback({success: false, reason: 'Game already started'});
    if(!player.host) return callback({success: false, reason: 'Permission denied'});

    game.boardSettings = boardSettings;
    callback({success: true});
    io.to(game.name).emit('updateLobby', game.lobbyData);
  });
  socket.on('getGames', (callback) => {
    callback(games.map(game => game.lobbyData));
  });
  //#endregion
  
  //#region chat handlers
  socket.on('chatMessage', (message) => {
    io.emit('chatMessage', {
      from: socket.data.player.username,
      text: message.text,
      createdAt: message.createdAt
    });
  });

  socket.on('setUsername', (username, callback) => {
    // remove non-ascii / non-printable characters
    username = username.replace(/[^ -~]/g,'');
    const player = socket.data.player;
    socket.broadcast.emit('serverMessage', {
      text: `${player.username} changed their username to ${username}`,
      createdAt: Date.now()
    });
    player.username = username;
    
    callback({success: true});
    if(player.currentGame) io.to(player.currentGame.name).emit('updateLobby', player.currentGame.lobbyData);
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
function getPlayer(data: CookieData): {player: Player, extraTab: boolean} {
  const id = data.id;

  // already connected (extra tab)
  const p = connectedClients[id];
  if(p) return {player: p, extraTab: true};

  // reconnecting to game
  for(let i=0; i<games.length; i++){
    const p = games[i].getPlayer(id);
    if(p) return {player: p, extraTab: false};
  }

  // not in game
  return {player: new Player(data), extraTab: false};
}

// looks through all sockets, except given socket, and notifies & disconnects all with matching player
async function disconnectOldTabs(socket: Socket, player: Player) {
  const sockets = await io.fetchSockets();
  sockets.forEach(s => {
    if(s.data.player !== player || s.id === socket.id) return;
    s.emit('oldTab');
    s.disconnect();
  });
}
//#endregion