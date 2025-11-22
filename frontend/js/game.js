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

function rotate(canvas, spin) {
  // get old rotation
  const oldRotation = canvas.style.rotate;
  
  // calculate new rotation
  const newRotation = String(parseInt(oldRotation.substring(0,oldRotation.length-3))+spin) + "deg";
  
  // animate to new rotation
  // animations auto-removed so no memory leak
  new Animation(new KeyframeEffect(
    canvas,
    [
      {rotate: oldRotation},
      {rotate: newRotation},
    ],
    {
      duration: SPIN_ANIMATION_DURATION,
    },
  )).play();

  // update rotation value
  canvas.style.rotate = newRotation;
}

function setupBoard() {
  // explicitly set default rotation value
  const canvases = document.getElementsByTagName('canvas');
  for(var i=0; i<canvases.length; i++){
    const canvas = canvases[i];
    canvas.style.rotate = "0deg";
  }

  const spawn = document.getElementById('spawn').getContext('2d');
  spawn.fillStyle = 'green';
  spawn.beginPath();
  spawn.arc(500, 500, 100, 0, 2*Math.PI);
  spawn.fill();
  spawn.strokeStyle = 'white';
  spawn.beginPath();
  spawn.moveTo(500, 500);
  spawn.lineTo(500, 400);
  spawn.stroke();

  const bridge1 = document.getElementById('bridge1').getContext('2d');
  bridge1.beginPath();
  bridge1.fillStyle = 'blue';
  bridge1.arc(500, 500, 200, 0, 2*Math.PI);
  bridge1.fill();
  bridge1.strokeStyle = 'white';
  bridge1.beginPath();
  bridge1.moveTo(500, 400);
  bridge1.lineTo(500, 300);
  bridge1.stroke();

  const land1 = document.getElementById('land1').getContext('2d');
  land1.beginPath();
  land1.fillStyle = 'green';
  land1.arc(500, 500, 300, 0, 2*Math.PI);
  land1.fill();
  land1.strokeStyle = 'white';
  land1.beginPath();
  land1.moveTo(500, 300);
  land1.lineTo(500, 200);
  land1.stroke();

  const bridge2 = document.getElementById('bridge2').getContext('2d');
  bridge2.beginPath();
  bridge2.fillStyle = 'blue';
  bridge2.arc(500, 500, 400, 0, 2*Math.PI);
  bridge2.fill();
  bridge2.strokeStyle = 'white';
  bridge2.beginPath();
  bridge2.moveTo(500, 200);
  bridge2.lineTo(500, 100);
  bridge2.stroke();

  const land2 = document.getElementById('land2').getContext('2d');
  land2.beginPath();
  land2.fillStyle = 'green';
  land2.arc(500, 500, 500, 0, 2*Math.PI);
  land2.fill();
  land2.strokeStyle = 'white';
  land2.beginPath();
  land2.moveTo(500, 100);
  land2.lineTo(500, 0);
  land2.stroke();
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