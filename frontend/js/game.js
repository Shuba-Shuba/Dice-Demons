const SPIN_ANIMATION_DURATION = 200;
var spin = 60;

const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");

// setup websocket
const socket = io();
socket.on('disconnect', () => {
  showMessage('Disconnected from server');
});
socket.on('connect', () => {
  showMessage('Connected to server');
});
socket.on('newMessage', (msg) => {
  showMessage(`<${msg.from}> ${msg.text}`);
});
socket.on('generateID', (id) => {
  setCookie('id', id);
  console.log('got ID from server: ', id);

  // unique default username
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


function setCookie(name, value) {
  var d = new Date();
  d.setTime(d.getTime() + 8640000);
  document.cookie = name + "=" + value + ";" + "expires=" + d.toUTCString() + ";path=/";
}

function getCookie(name) {
  if(name.length == 0) return undefined;
  var n = name + "=";
  var cookie = decodeURIComponent(document.cookie);
  if(cookie.indexOf(n) == -1) return undefined;
  var value = cookie.substring(cookie.indexOf(n)+n.length);
  if(value.indexOf(';') != -1) value = value.substring(0, value.indexOf(';'));
  return value;
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
  showMessage(`Set username to ${username}`);
  setCookie('username', username);
  socket.emit('setUsername', username);
}

function sendMessage() {
  const msg = document.getElementById("chat-input-text").value;
  socket.emit('createMessage', {
    text: msg,
    createdAt: Date.now()
  });
  document.getElementById("chat-input-text").value = "";
}

function showMessage(txt) {
  var p = document.createElement('p');
  p.textContent = txt;
  document.getElementById('chat-messages').appendChild(p);
  p.scrollIntoView();
}