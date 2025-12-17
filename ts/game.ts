import {io, Socket} from "socket.io-client";

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

const BOARD_SPAWN_WIDTH = 100;
const BOARD_LAND_WIDTH = 100;
const BOARD_BRIDGE_LENGTH = 100;
const BOARD_SPAWN_SPACES = 4;
const BOARD_SPACES_PER_BRIDGE = 8; // spaces counted on outside
const BOARD_RING_COUNT = 3; // excluding spawn
const BOARD_PIXEL_RADIUS = BOARD_SPAWN_WIDTH + BOARD_RING_COUNT*BOARD_LAND_WIDTH + BOARD_RING_COUNT*BOARD_BRIDGE_LENGTH;

const SPIN_ANIMATION_DURATION = 200;

const socket = io();


setupSocket();
setupLobby();
setupGame();
setupChat();


// WINDOW

function resize(): void {
  const a = document.querySelectorAll('canvas.board');
  let boardSize = Math.round(Math.min(document.getElementById('board').getBoundingClientRect().width,document.getElementById('board').getBoundingClientRect().height));
  if(boardSize % 2 === 0) boardSize -= 1;
  const px = boardSize + 'px';
  for(let i=0; i<a.length; i++){
    const c = a[i] as HTMLElement;

    if(c.style.width === px) return;
    
    c.style.width = px;
    c.style.height = px;
  }
}

// END WINDOW
// SERVER

function setCookie(key: string, value: string): void {
  // lasts up to 24 hours
  document.cookie = `${key}=${value};max-age=86400;path=/`;
}

function getCookie(key: string): string | undefined {
  const a = decodeURIComponent(document.cookie).split('; ');
  for(let i=0; i<a.length; i++){
    // str: 'key=value'
    const str = a[i];
    if(str.startsWith(key)) return str.substring(key.length + 1);
  };
}

function setupSocket(): void {
  // connections
  socket.on('disconnect', () => {
    receiveMessage('Disconnected from server');
  });
  socket.on('connect', () => {
    receiveMessage('Connected to server');
  });
  socket.on('error', ({text}) => {
    console.error('Server sent error:', text);
    alert("ERROR: " + text);
  });

  // ID
  socket.on('generateID', (id) => {
    setCookie('id', id);
    console.log('got ID from server:', id);

    // quasi-unique default username
    (document.getElementById('username-input-text') as HTMLInputElement).value = "unnamed" + (id%1000);
    setUsername();
  });

  // lobby
  socket.on('getGames', (games) => {
    if(games.length === 0) return document.getElementById('lobby-rooms').innerHTML = 'No games found on server :('

    document.getElementById('lobby-rooms').innerHTML = '';
    for(let i=0; i<games.length; i++){
      showGame(games[i]);
    }
  });
  socket.on('joinedGame', (game) => joinedGame(game));

  // chat
  socket.on('chatMessage', (msg) => {
    receiveMessage(`<${msg.from}> ${msg.text}`);
  });
  socket.on('serverMessage', (msg) => {
    receiveMessage(`${msg.text}`);
  });

  // game
  socket.on('rollDice', (rolls) => {
    // show rolls on screen
    const dice = document.getElementById('dice-container').children;
    for(let i=0; i<3; i++){
      dice[i].innerHTML = `${rolls[i]}`;
    }
  });
}

// END SERVER
// GAME CONTENT

function changeGamePage(page: string): void {
  document.querySelector('#game .game-page.shown').classList.remove('shown');
  document.getElementById(`game-${page}`).classList.add('shown');
}

function rotate(element: HTMLElement, rotation: number) {
  // get old rotation
  const oldRotation = element.style.rotate;
  
  // calculate new rotation
  const newRotation = String(parseFloat(oldRotation.substring(0,oldRotation.length-3))+rotation) + "deg";
  
  // animate to new rotation
  // animations auto-removed so no memory leak
  new Animation(new KeyframeEffect(
    element,
    [
      {rotate: oldRotation},
      {rotate: newRotation},
    ],
    {
      duration: SPIN_ANIMATION_DURATION,
    },
  )).play();

  // update rotation value
  element.style.rotate = newRotation;
}

function rollDice(): void {
  // server-side
  socket.emit('rollDice');
}

function setupGame(): void {
  setupBoard();
  addEventListener('resize', resize);
  document.getElementById('dice-container').addEventListener('click', rollDice);
}

function setupBoard(): void {
  // create spawn ring
  const spawn = document.createElement('canvas');
  spawn.classList.add('board');
  spawn.id = 'spawn';
  spawn.style.rotate = '0deg';
  spawn.style.zIndex = '99';
  spawn.width = BOARD_PIXEL_RADIUS*2;
  spawn.height = BOARD_PIXEL_RADIUS*2;
  drawLandRing(spawn.getContext('2d'), BOARD_SPAWN_WIDTH, BOARD_SPAWN_SPACES);
  document.getElementById('board').appendChild(spawn);

  // create outer rings
  for(let i=1; i<=BOARD_RING_COUNT; i++){
    // counting from 1

    const bridgeCanvas = document.createElement('canvas');
    bridgeCanvas.classList.add('board');
    bridgeCanvas.id = `bridge${i}`;
    bridgeCanvas.style.rotate = '0deg';
    bridgeCanvas.style.zIndex = `${100 - 2*i}`;
    bridgeCanvas.width = BOARD_PIXEL_RADIUS*2;
    bridgeCanvas.height = BOARD_PIXEL_RADIUS*2;
    drawBridgeRing(
      bridgeCanvas.getContext('2d'),
      BOARD_SPAWN_WIDTH + i*BOARD_BRIDGE_LENGTH + (i-1)*BOARD_LAND_WIDTH,
      BOARD_SPAWN_SPACES*Math.pow(2, i)
    );
    document.getElementById('board').appendChild(bridgeCanvas);

    const landCanvas = document.createElement('canvas');
    landCanvas.classList.add('board');
    landCanvas.id = `land${i}`;
    landCanvas.style.rotate = '0deg';
    landCanvas.style.zIndex = `${99 - 2*i}`;
    landCanvas.width = BOARD_PIXEL_RADIUS*2;
    landCanvas.height = BOARD_PIXEL_RADIUS*2;
    drawLandRing(
      landCanvas.getContext('2d'),
      BOARD_SPAWN_WIDTH + i*BOARD_BRIDGE_LENGTH + i*BOARD_LAND_WIDTH,
      BOARD_SPAWN_SPACES*Math.pow(2, i)
    );
    document.getElementById('board').appendChild(landCanvas);
  }
}

function drawBridgeRing(ctx: CanvasRenderingContext2D, r: number, spaces: number): void {
  const bridges = spaces/BOARD_SPACES_PER_BRIDGE;
  
  ctx.translate(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS);

  // blue circle
  ctx.beginPath();
  ctx.fillStyle = 'blue';
  ctx.arc(0,0, r, 0,2*Math.PI);
  ctx.fill();

  // bridges
  ctx.fillStyle = 'brown';
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  ctx.rotate(Math.PI/-2);
  const bridgeAngle = Math.PI*2/spaces;
  for(let i=0; i<bridges; i++){
    // add rotation
    ctx.rotate(Math.PI*2/bridges);
    
    // draw bridge
    ctx.beginPath();
    ctx.arc(0,0, r, bridgeAngle,0, true);
    ctx.arc(0,0, r-BOARD_BRIDGE_LENGTH+1, 0,bridgeAngle);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

function drawLandRing(ctx: CanvasRenderingContext2D, r: number, spaces: number): void {
  let landWidth = BOARD_LAND_WIDTH;
  if(r === BOARD_SPAWN_WIDTH) landWidth = r;

  ctx.translate(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS);

  // green circle
  ctx.beginPath();
  ctx.fillStyle = 'green';
  ctx.arc(0,0, r, 0,2*Math.PI);
  ctx.fill();

  // space separators
  ctx.strokeStyle = 'white';
  ctx.lineWidth = 3;
  for(let i=0; i<spaces; i++){
    // add rotation
    ctx.rotate(Math.PI*2/spaces);
    
    // draw line
    ctx.beginPath();
    ctx.moveTo(0, r-landWidth);
    ctx.lineTo(0, r-1);
    ctx.stroke();
  }
}

// END GAME CONTENT
// GAME LOBBY

function setupLobby(): void {
  document.getElementById('lobby-buttons').children[0].addEventListener('click', createGame);
  document.getElementById('lobby-buttons').children[1].addEventListener('click', getGames);
  getGames();
}

function showGame(game: GameLobbyData): void {
  const room = document.createElement('article');
  room.classList.add('lobby-room');

  const roomInfo = document.createElement('div');
  roomInfo.classList.add('lobby-room-info');
  const roomName = document.createElement('h2');
  roomName.textContent = game.name;
  roomInfo.appendChild(roomName);
  const roomStarted = document.createElement('p');
  if(game.started) roomStarted.textContent = 'Game in progress';
  else roomStarted.textContent = 'In lobby';
  roomInfo.appendChild(roomStarted);
  const roomPlayerCount = document.createElement('p');
  roomPlayerCount.textContent = `${game.players.length} players`;
  roomInfo.appendChild(roomPlayerCount);
  room.appendChild(roomInfo);

  const roomPlayers = document.createElement('div');
  roomPlayers.classList.add('lobby-room-players');
  for(let i=0; i<game.players.length; i++){
    const roomPlayer = document.createElement('p');
    roomPlayer.textContent = game.players[i];
    roomPlayers.appendChild(roomPlayer);
  }
  room.appendChild(roomPlayers);

  const roomJoinButton = document.createElement('button');
  roomJoinButton.textContent = 'Join Game';
  roomJoinButton.addEventListener('click', (function({target}){
    socket.emit('joinGame', this.name);
    target.textContent = 'Joining...';
  }).bind(game));
  room.appendChild(roomJoinButton);

  document.getElementById('lobby-rooms').appendChild(room);
}

function createGame(): void {
  socket.emit('createGame');
}

function joinedGame(game: GameLobbyData): void {
  changeGamePage('room');
  document.querySelector('#game-room h1').textContent = game.name;
  const roomPlayers = document.getElementById('room-players');
  for(let i=0; i<game.players.length; i++){
    const roomPlayer = document.createElement('p');
    roomPlayer.textContent = game.players[i];
    roomPlayers.appendChild(roomPlayer);
  }
}

function getGames(): void {
  document.getElementById('lobby-rooms').innerHTML = 'loading...';
  socket.emit('getGames');
}

// END GAME LOBBY
// CHAT

function setUsername(): void {
  const username = (document.getElementById('username-input-text') as HTMLInputElement).value;
  receiveMessage(`Set username to ${username}`);
  setCookie('username', username);
  socket.emit('setUsername', username);
}

function sendMessage(): void {
  const msg = document.getElementById("chat-input-text") as HTMLInputElement;
  socket.emit('createMessage', {
    text: msg.value,
    createdAt: Date.now()
  });
  msg.value = "";
}

function receiveMessage(txt: string): void {
  showMessage(txt);

  // save message
  var chatLog = JSON.parse(sessionStorage.getItem('chatLog'));
  if(chatLog === null) chatLog = [];
  chatLog.push(txt);
  sessionStorage.setItem('chatLog', JSON.stringify(chatLog));
}

function showMessage(txt: string): void {
  var p = document.createElement('p');
  p.textContent = txt;
  document.getElementById('chat-messages').appendChild(p);
  p.scrollIntoView();
}

function setupChat(): void {
  const username = document.getElementById('username-input-text') as HTMLInputElement;
  const usernameSend = document.getElementById('username-input-send') as HTMLButtonElement;
  const chat = document.getElementById('chat-input-text') as HTMLInputElement;
  const chatSend = document.getElementById('username-input-send') as HTMLButtonElement;

  // fill saved username
  if(getCookie('username')) username.placeholder = getCookie('username');
  else username.placeholder = "unnamed";

  // submit buttons
  usernameSend.addEventListener('click', setUsername);
  chatSend.addEventListener('click', sendMessage);

  // enter key submits chat input
  username.addEventListener('keydown', ({key}) => {
    if(key === 'Enter') setUsername();
  });
  chat.addEventListener('keydown', ({key}) => {
    if(key === 'Enter') sendMessage();
  });

  // load chat history from session storage
  var chatLog = JSON.parse(sessionStorage.getItem('chatLog'));
  if(chatLog !== null) for(const msg in chatLog){
    showMessage(chatLog[msg]);
  }
}

// END CHAT