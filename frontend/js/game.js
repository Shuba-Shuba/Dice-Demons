const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const SPIN_ANIMATION_DURATION = 200;

var spin = 60;

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

// initialize spin stuff
canvas.style.rotate = "0deg";

// draw canvas
context.fillStyle = "green";
context.beginPath();
context.arc(200,150,50,0,Math.PI*2);
context.fill();

context.fillStyle = "red";
context.fillRect(0,0,100,100);


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

function sendMessage() {
  const msg = document.getElementById("chat-input-text").value;
  socket.emit('createMessage', {
    from: 'client',
    text: msg,
    createdAt: Date.now()
  });
  document.getElementById("chat-input-text").value = "";
}

function showMessage(txt) {
  var p = document.createElement('p');
  p.textContent = txt;
  document.getElementById('chat-messages').appendChild(p);
}