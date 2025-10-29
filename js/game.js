const canvas = document.getElementById("canvas");
const context = canvas.getContext("2d");
const spinAnimation = new Animation(new KeyframeEffect(
  canvas,
  [
    {rotate: "0deg"},
    {rotate: "360deg"},
  ],
  {
    duration: 2000,
  },
));

var spinCW = true;

context.fillStyle = "green";
context.beginPath();
context.arc(200,150,50,0,Math.PI*2);
context.fill();

context.fillStyle = "red";
context.fillRect(0,0,100,100);


function spinButton() {
  spinAnimation.play();
}

function reverseButton() {
  spinAnimation.reverse();
  spinCW = !spinCW;
}

function cancelButton() {
  spinAnimation.cancel();
}