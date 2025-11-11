const SPIN_ANIMATION_DURATION = 200;
var spin = 60;

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

// setup websocket
const socket = io();
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

// setup canvas
canvas.style.rotate = "0deg";
context.fillStyle = "green";
context.beginPath();
context.arc(200,150,50,0,Math.PI*2);
context.fill();
context.fillStyle = "red";
context.fillRect(0,0,100,100);

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

function spinButton() {
  // animate to new state
  spinAnimation();
}

function reverseButton() {
  // flip spin direction
  spin *= -1;
}

function spinAnimation() {
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