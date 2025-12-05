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


function resizeLoad() {
  // check board size every ~10ms until it stops returning 0
  if(document.getElementById('board').getBoundingClientRect().width === 0){
    return setTimeout(resizeLoad, 0);
  }
  document.querySelectorAll('#menu button').forEach((e) => {
    e.addEventListener('click', resize);
  });
  resize();
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

function setCookie(key, value) {
  // lasts up to 24 hours
  document.cookie = `${key}=${value};max-age=86400;path=/`;
}

function getCookie(key) {
  const a = decodeURIComponent(document.cookie).split('; ');
  for(const i in a){
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

  // ID
  socket.on('generateID', (id) => {
    setCookie('id', id);
    console.log('got ID from server: ', id);

    // quasi-unique default username
    document.getElementById('username-input-text').value = "unnamed" + (id%1000);
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

function rotate(element, rotation) {
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

function rollDice() {
  // server-side
  socket.emit('rollDice');
}

function setupLobby() {
  document.getElementById('lobby-buttons').children[0].addEventListener('click', createGame);
  document.getElementById('lobby-buttons').children[1].addEventListener('click', getGames);
  getGames();
}

function setupGame() {
  setupBoard();
  addEventListener('resize', resize);
  addEventListener('load', resizeLoad, {once: true});
  document.getElementById('dice-container').addEventListener('click', rollDice);
}

function setupBoard() {
  // create spawn ring
  const spawn = document.createElement('canvas');
  spawn.classList.add('board');
  spawn.id = 'spawn';
  spawn.style.rotate = '0deg';
  spawn.style.zIndex = 99;
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
    bridgeCanvas.style.zIndex = 100 - 2*i;
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
    landCanvas.style.zIndex = 99 - 2*i;
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

function setUsername() {
  const username = document.getElementById('username-input-text').value;
  document.getElementById('username-input-text').placeholder = username;
  document.getElementById('username-input-text').value = "";
  receiveMessage(`Set username to ${username}`);
  setCookie('username', username);
  socket.emit('setUsername', username);
}

function sendMessage() {
  const msg = document.getElementById("chat-input-text").value;
  document.getElementById("chat-input-text").value = "";
  socket.emit('createMessage', {
    text: msg,
    createdAt: Date.now()
  });
}

function receiveMessage(txt) {
  showMessage(txt);

  // save message
  var chatLog = JSON.parse(sessionStorage.getItem('chatLog'));
  if(chatLog === null) chatLog = [];
  chatLog.push(txt);
  sessionStorage.setItem('chatLog', JSON.stringify(chatLog));
}

function showMessage(txt) {
  var p = document.createElement('p');
  p.textContent = txt;
  document.getElementById('chat-messages').appendChild(p);
  p.scrollIntoView();
}

function setupChat() {
  // fill saved username
  if(getCookie('username')) document.getElementById('username-input-text').placeholder = getCookie('username');
  else document.getElementById('username-input-text').placeholder = "unnamed";

  // enter key submits chat input
  document.getElementById('chat').onkeydown = (e) => {
    if(
      e.key === 'Enter' 
      && e.target.tagName === 'INPUT'
      && e.target.parentElement.classList.contains('chat-input')
    ){
      e.target.parentElement.querySelector('button').click();
    }
  };

  // load chat history from session storage
  var chatLog = JSON.parse(sessionStorage.getItem('chatLog'));
  if(chatLog !== null) for(const msg in chatLog){
    showMessage(chatLog[msg]);
  }
}

function showGame(game) {
  const room = document.createElement('div');
  room.classList.add('lobby-room');
  
  const roomInfo = document.createElement('div');
  roomInfo.classList.add('lobby-room-info');
  const roomName = document.createElement('h4');
  roomName.textContent = game.name;
  roomInfo.appendChild(roomName);
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
  roomJoinButton.addEventListener('click', () => socket.emit('joinGame'));
  room.appendChild(roomJoinButton);

  document.getElementById('lobby-rooms').appendChild(room);
}

function createGame() {
  socket.emit('createGame');
  getGames();
}

function getGames() {
  document.getElementById('lobby-rooms').innerHTML = 'loading...';
  socket.emit('getGames');
}