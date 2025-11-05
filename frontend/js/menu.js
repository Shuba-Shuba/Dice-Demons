// create menu buttons
fetch('pages.json')
  .then(response => response.json())
  .then(pages => {
    for(var page in pages){
      var button = document.createElement('button');
      button.textContent = pages[page].title
      button.id = pages[page].id + "-menubutton";
      button.addEventListener('click', menuButton);
      document.getElementById('menu').appendChild(button);
      if(pages[page].initial) button.menuButton();
    }
  });

function menuButton() {
  // don't do anything if clicked button's page is already the current page
  if(document.getElementById('current-page-container').children[0].id === this.id) return;

  // move old page from current container to hidden container
  document.getElementById('hidden-page-container').appendChild(document.getElementById('current-page-container').children[0]);

  // move clicked button's page to current container
  document.getElementById('current-page-container').appendChild(document.getElementById(this.id.substring(0, this.id.length - 11)));
}