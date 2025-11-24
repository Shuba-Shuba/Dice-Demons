const BOARD_SPAWN_WIDTH = 100;
const BOARD_LAND_WIDTH = 100;
const BOARD_BRIDGE_LENGTH = 100;
const BOARD_SPAWN_SPACES = 4;
const BOARD_SPACES_TO_BRIDGES_RATIO = 8;
const BOARD_RING_COUNT = 3; // excluding spawn
const BOARD_PIXEL_RADIUS = BOARD_SPAWN_WIDTH + BOARD_RING_COUNT*BOARD_LAND_WIDTH + BOARD_RING_COUNT*BOARD_BRIDGE_LENGTH;

const SPIN_ANIMATION_DURATION = 200;

const socket = io();


setupSocket();
setupBoard();
setupChat();


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
  socket.on('disconnect', () => {
    receiveMessage('Disconnected from server');
  });
  socket.on('connect', () => {
    receiveMessage('Connected to server');
  });
  socket.on('chatMessage', (msg) => {
    receiveMessage(`<${msg.from}> ${msg.text}`);
  });
  socket.on('serverMessage', (msg) => {
    receiveMessage(`${msg.text}`);
  });
  socket.on('generateID', (id) => {
    setCookie('id', id);
    console.log('got ID from server: ', id);

    // quasi-unique default username
    document.getElementById('username-input-text').value = "unnamed" + (id%1000);
    setUsername();
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

function setupBoard() {
  // create canvases
  const spawn = document.createElement('canvas');
  spawn.classList.add('board');
  spawn.id = 'spawn';
  spawn.style.rotate = '0deg';
  spawn.style.zIndex = -1;
  spawn.width = BOARD_PIXEL_RADIUS*2;
  spawn.height = BOARD_PIXEL_RADIUS*2;
  document.getElementById('board').appendChild(spawn);
  for(let i=1; i<=BOARD_RING_COUNT; i++){
    // counting from 1

    const bridgeCanvas = document.createElement('canvas');
    bridgeCanvas.classList.add('board');
    bridgeCanvas.id = `bridge${i}`;
    bridgeCanvas.style.rotate = '0deg';
    bridgeCanvas.style.zIndex = -2*i;
    bridgeCanvas.width = BOARD_PIXEL_RADIUS*2;
    bridgeCanvas.height = BOARD_PIXEL_RADIUS*2;
    document.getElementById('board').appendChild(bridgeCanvas);

    const landCanvas = document.createElement('canvas');
    landCanvas.classList.add('board');
    landCanvas.id = `land${i}`;
    landCanvas.style.rotate = '0deg';
    landCanvas.style.zIndex = -2*i - 1;
    landCanvas.width = BOARD_PIXEL_RADIUS*2;
    landCanvas.height = BOARD_PIXEL_RADIUS*2;
    document.getElementById('board').appendChild(landCanvas);
  }

  // create rings
  const spawnCtx = document.getElementById('spawn').getContext('2d');
  createLandRing(spawnCtx, BOARD_SPAWN_WIDTH, BOARD_SPAWN_SPACES);
  for(let i=1; i<=BOARD_RING_COUNT; i++){
    // counting from 1
    createBridgeRing(document.getElementById(`bridge${i}`).getContext('2d'), BOARD_SPAWN_WIDTH + i*BOARD_BRIDGE_LENGTH + (i-1)*BOARD_LAND_WIDTH, BOARD_SPAWN_SPACES*Math.pow(2, i));
    createLandRing(document.getElementById(`land${i}`).getContext('2d'), BOARD_SPAWN_WIDTH + i*BOARD_BRIDGE_LENGTH + i*BOARD_LAND_WIDTH, BOARD_SPAWN_SPACES*Math.pow(2, i));
  }
}

function createBridgeRing(ctx, r, spaces) {
  // spaces counted on outside
  const bridges = spaces/BOARD_SPACES_TO_BRIDGES_RATIO;

  // blue circle
  ctx.beginPath();
  ctx.fillStyle = 'blue';
  ctx.arc(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS, r, 0,2*Math.PI);
  ctx.fill();

  // bridges
  // line through middle of bridge
  ctx.strokeStyle = 'brown';
  ctx.lineWidth = 50;
  ctx.translate(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS);
  ctx.rotate(Math.PI/spaces);
  ctx.translate(-BOARD_PIXEL_RADIUS,-BOARD_PIXEL_RADIUS);
  for(let i=0; i<bridges; i++){
    // add rotation
    ctx.translate(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS);
    ctx.rotate(Math.PI*2/bridges);
    ctx.translate(-BOARD_PIXEL_RADIUS,-BOARD_PIXEL_RADIUS);

    // draw line
    ctx.beginPath();
    ctx.moveTo(BOARD_PIXEL_RADIUS, BOARD_PIXEL_RADIUS - r + BOARD_BRIDGE_LENGTH);
    ctx.lineTo(BOARD_PIXEL_RADIUS, BOARD_PIXEL_RADIUS - r);
    ctx.stroke();
  }
}

function createLandRing(ctx, r, spaces) {
  let landWidth = BOARD_LAND_WIDTH;
  if(r === BOARD_SPAWN_WIDTH) landWidth = r;

  // green circle
  ctx.beginPath();
  ctx.fillStyle = 'green';
  ctx.arc(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS, r, 0,2*Math.PI);
  ctx.fill();

  // space separators
  ctx.strokeStyle = 'white';
  for(let i=0; i<spaces; i++){
    // add rotation
    ctx.translate(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS);
    ctx.rotate(Math.PI*2/spaces);
    ctx.translate(-BOARD_PIXEL_RADIUS,-BOARD_PIXEL_RADIUS);

    // draw line
    ctx.beginPath();
    ctx.moveTo(BOARD_PIXEL_RADIUS, BOARD_PIXEL_RADIUS - r + landWidth);
    ctx.lineTo(BOARD_PIXEL_RADIUS, BOARD_PIXEL_RADIUS - r);
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
      e.key === 'Enter' &&
      e.target.tagName === 'INPUT' &&
      e.target.parentElement.classList.contains('chat-input')
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