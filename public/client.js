//#region CONSTANTS
const BOARD_SPAWN_WIDTH = 100;
const BOARD_LAND_WIDTH = 100;
const BOARD_BRIDGE_LENGTH = 100;
const BOARD_SPAWN_SPACES = 4;
const BOARD_SPACES_PER_BRIDGE = 8; // spaces counted on outside
const BOARD_RING_COUNT = 3; // excluding spawn
const BOARD_PIXEL_RADIUS = BOARD_SPAWN_WIDTH + BOARD_RING_COUNT*BOARD_LAND_WIDTH + BOARD_RING_COUNT*BOARD_BRIDGE_LENGTH;
const SPIN_ANIMATION_DURATION = 200;
const socket = io();
//#endregion

//#region RUN SETUP
setupMenu();
setupSocket();
setupLobby();
setupGame();
setupChat();
//#endregion RUN SETUP

//#region WINDOW & NAV

function setupMenu() {
  // set up menu buttons
  for(const button of document.getElementById('menu').children){
    button.addEventListener('click', changePage);
    button.addEventListener('click', resize);
  };

  // show initial page (game)
  document.getElementById('game-menubutton').classList.add('selected');
  document.getElementById('game').classList.add('selected');
}

function resize() {
  const a = document.querySelectorAll('canvas.board');
  let boardSize = Math.round(Math.min(document.getElementById('board').getBoundingClientRect().width,document.getElementById('board').getBoundingClientRect().height));
  if(boardSize % 2 === 0) boardSize -= 1;
  const px = boardSize + 'px';
  for(let i=0; i<a.length; i++){
    const c = a[i];

    if(c.style.width === px) return;
    
    c.style.width = px;
    c.style.height = px;
  }
}

function changePage(){
  const buttonId = this.id;
  const pageId = buttonId.substring(0, buttonId.length-11);

  // unselect old button & select new button
  document.querySelector('#menu button.selected').classList.remove('selected');
  document.getElementById(buttonId).classList.add('selected');

  // hide old page & show new page
  document.querySelector('#content .page.selected').classList.remove('selected');
  document.getElementById(pageId).classList.add('selected');

  // chat menu button instantly scrolls down to bottom (most recent) message
  if(buttonId === 'chat-menubutton') document.getElementById('chat-messages').children[document.getElementById('chat-messages').children.length-1].scrollIntoView({behavior: 'instant'});
}

//#endregion WINDOW & NAV
//#region SERVER

function setCookie(key, value) {
  // lasts up to 24 hours
  document.cookie = `${key}=${value};max-age=86400;path=/`;
}

function getCookie(key) {
  const a = decodeURIComponent(document.cookie).split('; ');
  for(let i=0; i<a.length; i++){
    // str: 'key=value'
    const str = a[i];
    if(str.startsWith(key)) return str.substring(key.length + 1);
  };
}

function setupSocket() {
  // connections
  socket.on('disconnect', () => {
    receiveMessage('Disconnected from server');
  });
  socket.on('connect', () => {
    receiveMessage('Connected to server');
  });
  socket.on('status', (status, game) => {
    //const extraTab = Math.floor(status/2) === 1;
    const reconnected = status%2 === 1;
    if(reconnected) {
      if(game.started) console.log('reconnect to started game');
      else joinedGame(game);
    } else {
      getGames();
    }
  });
  socket.on('generateID', (id, username) => {
    setCookie('id', id);
    setCookie('username', username);
    document.getElementById('chat-input-username').value = username;
  });

  // chat
  socket.on('chatMessage', (msg) => {
    receiveMessage(`<${msg.from}> ${msg.text}`);
  });
  socket.on('serverMessage', (msg) => {
    receiveMessage(`${msg.text}`);
  });

  // game
  socket.on('updateLobby', (game) => updateLobby(game));
  socket.on('rollDice', (rolls) => rollDice(rolls));
}

//#endregion SERVER
//#region GAME CONTENT

function changeGamePage(page) {
  document.querySelector('#game .game-page.shown').classList.remove('shown');
  document.getElementById(`game-${page}`).classList.add('shown');
}

function rotate(element, rotation) {
  // get old rotation
  const oldRotation = element.style.rotate;
  
  // calculate new rotation
  const newRotation = String(parseFloat(oldRotation.substring(0,oldRotation.length-3))+rotation) + 'deg';
  
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

function rollDice(rolls) {
  // show dice rolls on screen
  const dice = document.getElementById('dice-container').children;
  for(let i=0; i<3; i++){
    dice[i].textContent = rolls[i];
  }
}

function setupGame() {
  setupBoard();
  addEventListener('resize', resize);
  document.getElementById('dice-container').addEventListener('click', () => {
    socket.emit('gameAction', 'rollDice');
  });
}

function setupBoard() {
  const board = document.getElementById('board');
  board.textContent = null;

  // create spawn ring
  const spawn = document.createElement('canvas');
  spawn.classList.add('board');
  spawn.id = 'spawn';
  spawn.style.rotate = '0deg';
  spawn.style.zIndex = '99';
  spawn.width = BOARD_PIXEL_RADIUS*2;
  spawn.height = BOARD_PIXEL_RADIUS*2;
  drawLandRing(spawn.getContext('2d'), BOARD_SPAWN_WIDTH, BOARD_SPAWN_SPACES);
  board.appendChild(spawn);

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
    board.appendChild(bridgeCanvas);

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
    board.appendChild(landCanvas);
  }
}

function drawBridgeRing(ctx, r, spaces) {
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

function drawLandRing(ctx, r, spaces) {
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

//#endregion GAME CONTENT
//#region GAME LOBBY

function setupLobby() {
  // main menu
  document.getElementById('lobby-create').addEventListener('click', createGame);
  document.getElementById('lobby-refresh').addEventListener('click', getGames);

  // game room
  document.getElementById('room-leave').addEventListener('click', leaveGame);
  //document.getElementById('room-ready').addEventListener('click', ready);
}

function showGame(game) {
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
  if(game.players.length === 1) roomPlayerCount.textContent = '1 player';
  else roomPlayerCount.textContent = `${game.players.length} players`;
  roomInfo.appendChild(roomPlayerCount);
  room.appendChild(roomInfo);

  const roomPlayers = document.createElement('div');
  roomPlayers.classList.add('lobby-room-players');
  for(let i=0; i<game.players.length; i++){
    const roomPlayer = document.createElement('p');
    roomPlayer.textContent = game.players[i].username;
    roomPlayers.appendChild(roomPlayer);
  }
  room.appendChild(roomPlayers);

  const roomJoinButton = document.createElement('button');
  roomJoinButton.textContent = 'Join Game';
  roomJoinButton.addEventListener('click', joinGame.bind(game));
  room.appendChild(roomJoinButton);

  document.getElementById('lobby-rooms').appendChild(room);

  // join game automatically if name matches hash
  if(game.name.replaceAll(' ','') === location.hash.substring(1)) roomJoinButton.click();
}

async function joinGame({target}) {
  // this = game lobby data
  const oldText = target.textContent;
  target.textContent = 'Joining...';
  try {
    const response = await socket.timeout(1000).emitWithAck('joinGame', this.name);
    target.textContent = oldText;
    if(response.success) {
      joinedGame(response.game);
    } else {
      history.replaceState(null,'','/');
      console.error('Error joining game:', response.reason);
      alert('Error joining game: ' + response.reason);
    }
  } catch {
    target.textContent = oldText;
    history.replaceState(null,'','/');
    const errorMsg = 'Server did not respond in time to join game request';
    console.error(errorMsg);
    alert(errorMsg);
  }
}

async function createGame({target}) {
  const oldText = target.textContent;
  target.textContent = 'Creating...';
  try {
    const response = await socket.timeout(1000).emitWithAck('createGame');
    target.textContent = oldText;
    if(response.success) {
      joinedGame(response.game);
    } else {
      console.error('Error creating game:', response.reason);
      alert('Error creating game: ' + response.reason);
    }
  } catch {
    target.textContent = oldText;
    const errorMsg = 'Server did not respond in time to create game request';
    console.error(errorMsg);
    alert(errorMsg);
  }
}

function joinedGame(game) {
  updateLobby(game);
  location.hash = game.name.replaceAll(' ','');
  changeGamePage('room');
}

function updateLobby(game) {
  document.querySelector('#game-room h1').textContent = game.name;
  const roomPlayers = document.getElementById('room-players');
  roomPlayers.textContent = null;
  for(let i=0; i<game.players.length; i++){
    const roomPlayer = document.createElement('p');
    roomPlayer.textContent = game.players[i].username;
    roomPlayers.appendChild(roomPlayer);
  }
}

async function leaveGame({target}) {
  const oldText = target.textContent;
  target.textContent = 'Leaving...';
  try {
    const response = await socket.timeout(1000).emitWithAck('leaveGame');
    target.textContent = oldText;
    if(response.success) {
      getGames();
      history.replaceState(null,'','/');
      changeGamePage('lobby');
    } else {
      console.error('Error leaving game:', response.reason);
      alert('Error leaving game: ' + response.reason);
    }
  } catch {
    target.textContent = oldText;
    const errorMsg = 'Server did not respond in time to leave game request';
    console.error(errorMsg);
    alert(errorMsg);
  }
}

async function getGames() {
  const lobby = document.getElementById('lobby-rooms');
  lobby.textContent = 'loading...';
  try {
    const games = await socket.timeout(1000).emitWithAck('getGames');
    
    if(games.length === 0) return lobby.textContent = 'No games found on server :('
    lobby.textContent = null;

    for(let i=0; i<games.length; i++){
      showGame(games[i]);
    }
  } catch {
    const errorMsg = 'Server did not respond in time to get game list request';
    console.error(errorMsg);
    lobby.textContent = errorMsg;
  }
}

//#endregion GAME LOBBY
//#region CHAT

async function setUsername(username) {
  try {
    const response = await socket.timeout(1000).emitWithAck('setUsername', username);
    if(response.success){
      receiveMessage(`Set username to ${username}`);
      setCookie('username', username);
      document.getElementById('chat-input-username').value = username;
    } else {
      const errorMsg = `Failed to set username: ${response.reason}`;
      console.error(errorMsg);
      alert(errorMsg);
    }
  } catch {
    const errorMsg = 'Server did not respond in time to set username request';
    console.error(errorMsg);
    showMessage(errorMsg);
  }
}

function sendChatMessage() {
  const msg = document.getElementById('chat-input-message');
  socket.emit('chatMessage', {
    text: msg.value,
    createdAt: Date.now()
  });
  msg.value = '';
}

function receiveMessage(txt) {
  showMessage(txt);

  // save message
  const chatLog = JSON.parse(sessionStorage.getItem('chatLog')) ?? [];
  chatLog.push(txt);
  sessionStorage.setItem('chatLog', JSON.stringify(chatLog));
}

function showMessage(txt) {
  const p = document.createElement('p');
  p.textContent = txt;
  document.getElementById('chat-messages').appendChild(p);
  p.scrollIntoView();
}

function setupChat() {
  const username = document.getElementById('chat-input-username');
  const chat = document.getElementById('chat-input-message');

  // fill saved username
  if(getCookie('username')) username.value = getCookie('username');
  else username.value = 'unnamed';

  // enter key submits text input
  username.addEventListener('keydown', ({target, key}) => {
    if(key === 'Enter') setUsername(target.value);
  });
  chat.addEventListener('keydown', ({key}) => {
    if(key === 'Enter') sendChatMessage();
  });

  // deselecting username input submits if changed
  username.addEventListener('blur', ({target}) => {
    if(target.value !== getCookie('username')) setUsername(target.value);
  });

  // load chat history from session storage
  const chatLog = JSON.parse(sessionStorage.getItem('chatLog'));
  if(chatLog !== null) for(const msg of chatLog){
    showMessage(msg);
  }
}

//#endregion CHAT