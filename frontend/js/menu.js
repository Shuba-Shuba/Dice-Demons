// create menu buttons
fetch('pages.json')
  .then(response => response.json())
  .then(pages => {
    for(var page in pages){
      var a = document.createElement('a');
      a.href = `#${pages[page].id}`
      document.getElementById('menu').appendChild(a);
      var button = document.createElement('button');
      button.textContent = pages[page].title
      button.id = pages[page].id + "-menubutton";
      a.appendChild(button);
      if(pages[page].initial){
        button.classList.add('selected');
        if(location.hash === '') location.hash = pages[page].id;
      }
    }
    addEventListener('hashchange', changePage);
    changePage();
  });


function changePage(){
  const pageId = location.hash.substring(1);
  const buttonId = pageId + "-menubutton";

  // don't do anything if clicked button's page is already the current page
  if(document.getElementById('current-page-container').children[0].id === buttonId) return;
  

  // unselect old page button
  document.querySelector('#menu button.selected').classList.remove('selected');

  // select this page button
  document.getElementById(buttonId).classList.add('selected');


  // move old page from current container to hidden container
  document.getElementById('hidden-page-container').appendChild(document.getElementById('current-page-container').children[0]);

  // move clicked button's page to current container
  document.getElementById('current-page-container').appendChild(document.getElementById(pageId));
}