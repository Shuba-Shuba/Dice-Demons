// create menu buttons
fetch('pages.json')
  .then(response => response.json())
  .then(pages => {
    for(var page in pages){
      var button = document.createElement('button');
      button.textContent = pages[page].title;
      button.id = pages[page].id + "-menubutton";
      button.addEventListener('click', menuButton);
      document.getElementById('menu').appendChild(button);
      if(pages[page].initial){
        document.getElementById(pages[page].id).classList.add('selected');
        button.classList.add('selected');
        if(location.href.split('/')[3] === ''){
          history.replaceState(null, document.title, `/${pages[page].id}`);
          dispatchEvent(new Event('popstate'));
        }
      }
    }
    addEventListener('popstate', changePage);
    // remove trailing slash
    history.replaceState(null, document.title, `/${location.href.split('/')[3]}`);
    dispatchEvent(new Event('popstate'));
  });


function changePage(){
  const pageId = location.href.split('/')[3];
  const buttonId = pageId + "-menubutton";

  // unselect old button & select new button
  document.querySelector('#menu button.selected').classList.remove('selected');
  document.getElementById(buttonId).classList.add('selected');

  // hide old page & show new page
  document.querySelector('#content .page.selected').classList.remove('selected');
  document.getElementById(pageId).classList.add('selected');
}


function menuButton(){
  // don't do anything if clicked button's page is already the current page
  if(this.classList.contains('selected')) return;

  history.pushState(null, document.title, `/${this.id.substring(0,this.id.length-11)}`);
  dispatchEvent(new Event('popstate'));
}