const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const SPIN_ANIMATION_DURATION = 400;


var spin = 60;


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
  document.getElementById("tmp_spin").textContent = spin;

  // animate to new state
  spinAnimation();
}

function spinAnimation() {
  // get old rotation
  var rotationStr = canvas.style.rotate;
  var rotation = parseInt(rotationStr.substring(0,rotationStr.length-3));
  
  // animate to new rotation
  // animations auto-removed so no memory leak
  new Animation(new KeyframeEffect(
    canvas,
    [
      {rotate: rotationStr},
      {rotate: String(rotation+spin) + "deg"},
    ],
    {
      duration: SPIN_ANIMATION_DURATION,
    },
  )).play();

  // update rotation value
  canvas.style.rotate = String(rotation+spin) + "deg";
}