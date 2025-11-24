const BOARD_PIXEL_RADIUS = 700;
const BOARD_INLAND_TO_BRIDGES_RATIO = 4;
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
  const newRotation = String(parseInt(oldRotation.substring(0,oldRotation.length-3))+rotation) + "deg";
  
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
  // explicitly set default rotation value
  const canvases = document.getElementsByTagName('canvas');
  for(var i=0; i<canvases.length; i++){
    const canvas = canvases[i];
    canvas.style.rotate = "0deg";
  }

  // create rings
  const spawn = document.getElementById('spawn').getContext('2d');
  // spawn.fillStyle = 'green';
  // spawn.beginPath();
  // spawn.arc(700, 700, 100, 0, 2*Math.PI);
  // spawn.fill();
  // spawn.strokeStyle = 'white';
  // spawn.beginPath();
  // spawn.moveTo(700, 700);
  // spawn.lineTo(700, 600);
  // spawn.stroke();
  createLandRing(spawn, 100, 4);

  const bridge1 = document.getElementById('bridge1').getContext('2d');
  // bridge1.beginPath();
  // bridge1.fillStyle = 'blue';
  // bridge1.arc(700, 700, 200, 0, 2*Math.PI);
  // bridge1.fill();
  // bridge1.strokeStyle = 'white';
  // bridge1.beginPath();
  // bridge1.moveTo(700, 600);
  // bridge1.lineTo(700, 500);
  // bridge1.stroke();
  createBridgeRing(bridge1, 200, 4);

  const land1 = document.getElementById('land1').getContext('2d');
  // land1.beginPath();
  // land1.fillStyle = 'green';
  // land1.arc(700, 700, 300, 0, 2*Math.PI);
  // land1.fill();
  // land1.strokeStyle = 'white';
  // land1.beginPath();
  // land1.moveTo(700, 500);
  // land1.lineTo(700, 400);
  // land1.stroke();
  createLandRing(land1, 300, 8);

  const bridge2 = document.getElementById('bridge2').getContext('2d');
  // bridge2.beginPath();
  // bridge2.fillStyle = 'blue';
  // bridge2.arc(700, 700, 400, 0, 2*Math.PI);
  // bridge2.fill();
  // bridge2.strokeStyle = 'white';
  // bridge2.beginPath();
  // bridge2.moveTo(700, 400);
  // bridge2.lineTo(700, 300);
  // bridge2.stroke();
  createBridgeRing(bridge2, 400, 8);

  const land2 = document.getElementById('land2').getContext('2d');
  // land2.beginPath();
  // land2.fillStyle = 'green';
  // land2.arc(700, 700, 500, 0, 2*Math.PI);
  // land2.fill();
  // land2.strokeStyle = 'white';
  // land2.beginPath();
  // land2.moveTo(700, 300);
  // land2.lineTo(700, 200);
  // land2.stroke();
  createLandRing(land2, 500, 16);

  const bridge3 = document.getElementById('bridge3').getContext('2d');
  // bridge3.beginPath();
  // bridge3.fillStyle = 'blue';
  // bridge3.arc(700, 700, 600, 0, 2*Math.PI);
  // bridge3.fill();
  // bridge3.strokeStyle = 'white';
  // bridge3.beginPath();
  // bridge3.moveTo(700, 200);
  // bridge3.lineTo(700, 100);
  // bridge3.stroke();'
  createBridgeRing(bridge3, 600, 16);

  const land3 = document.getElementById('land3').getContext('2d');
  // land3.beginPath();
  // land3.fillStyle = 'green';
  // land3.arc(700, 700, 700, 0, 2*Math.PI);
  // land3.fill();
  // land3.strokeStyle = 'white';
  // land3.beginPath();
  // land3.moveTo(700, 100);
  // land3.lineTo(700, 0);
  // land3.stroke();
  createLandRing(land3, 700, 32);
}

function createBridgeRing(ctx, r, spaces) {
  // spaces counted inland
  const bridges = spaces/BOARD_INLAND_TO_BRIDGES_RATIO;

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
  ctx.rotate(Math.PI/2/spaces);
  ctx.translate(-BOARD_PIXEL_RADIUS,-BOARD_PIXEL_RADIUS);
  for(let i=0; i<bridges; i++){
    // add rotation
    ctx.translate(BOARD_PIXEL_RADIUS,BOARD_PIXEL_RADIUS);
    ctx.rotate(Math.PI*2/bridges);
    ctx.translate(-BOARD_PIXEL_RADIUS,-BOARD_PIXEL_RADIUS);

    // draw line
    ctx.beginPath();
    ctx.moveTo(BOARD_PIXEL_RADIUS, BOARD_PIXEL_RADIUS - r + 100);
    ctx.lineTo(BOARD_PIXEL_RADIUS, BOARD_PIXEL_RADIUS - r);
    ctx.stroke();
  }
}

function createLandRing(ctx, r, spaces) {
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
    ctx.moveTo(BOARD_PIXEL_RADIUS, BOARD_PIXEL_RADIUS - r + 100);
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