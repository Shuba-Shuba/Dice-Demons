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
  // const pageId = location.hash.substring(1);
  const pageId = location.href.split('/')[3];
  const buttonId = pageId + "-menubutton";
  

  // unselect old page button
  document.querySelector('#menu button.selected').classList.remove('selected');

  // select this page button
  document.getElementById(buttonId).classList.add('selected');


  // move old page from current container to hidden container
  document.getElementById('hidden-page-container').appendChild(document.getElementById('current-page-container').children[0]);

  // move clicked button's page to current container
  document.getElementById('current-page-container').appendChild(document.getElementById(pageId));
}


function menuButton(){
  // don't do anything if clicked button's page is already the current page
  if(this.classList.contains('selected')) return;

  history.pushState(null, document.title, `/${this.id.substring(0,this.id.length-11)}`);
  dispatchEvent(new Event('popstate'));
}