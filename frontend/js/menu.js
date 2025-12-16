// create menu buttons
fetch('pages.json')
  .then(response => response.json())
  .then(pages => {
    for(var page in pages){
      var button = document.createElement('button');
      button.textContent = pages[page].title;
      button.id = pages[page].id + "-menubutton";
      button.addEventListener('click', changePage);
      document.getElementById('menu').appendChild(button);
      if(pages[page].initial){
        document.getElementById(pages[page].id).classList.add('selected');
        button.classList.add('selected');
        document.getElementById(pages[page].id).click();
      }
    }
  });


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