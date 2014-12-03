// all I want to do initially, as a test, is get a list of files... 

var request = require('miniagent');
var vfsRoot = window.location.protocol + "//" + window.location.host + "/vfs";
var broker = new (require('events')).EventEmitter();
var domify = require('domify');

var ace = require('brace');
require('brace/mode/json');
require('brace/mode/markdown');
require('brace/theme/monokai');

var fileSystem = {
  children : {
    root : {
      entities : [],
      name : "/",
      href : vfsRoot + "/",
      children : {},
      parent : false
    }
  }
};

var editSessions = {};


var fileSystemViewElements = {};
var forEach = Array.prototype.forEach;

var page = createBox('page');
page.position(0,0);
page.size(window.innerWidth, window.innerHeight);
page.appendToElement(document.querySelector('body'));



var fileNavigation = createBox('file-nav');
fileNavigation.position(0,0);
fileNavigation.size(301, window.innerHeight);
page.addBox(fileNavigation);

var files = document.createElement('ul');
files.className = "box-inner files";
fileNavigation.addElement(files);


var contentView = createBox('content-view');
contentView.position(301,0);
contentView.size(window.innerWidth - 302, window.innerHeight);
page.addBox(contentView);

var content = domify([
  '<div class="box-inner content">',
  '<ul class="tabs"></ul>',
  '<ul class="tab-bodies"></ul>',
  '</div>'
].join('\n'));

contentView.addElement(content);

function getContentViewSize (){
  var headerHeight = content.querySelector('ul.tabs').offsetHeight;
  var pageSize = contentView.size();
  return {
    x : pageSize.x,
    y : pageSize.y,
    headerHeight : headerHeight
  }

};

window.onresize = function (event){
  page.size(window.innerWidth, window.innerHeight);
  fileNavigation.size(300, window.innerHeight);
  contentView.size(window.innerWidth - 301, window.innerHeight);
}

function createBox (className){

  var el = document.createElement('div');
  var style = el.style;
  el.className = "box " + className ;
  style.position = "absolute";
  style.top = "0px";
  style.left = "0px";
  style.width = "0px";
  style.height = "0px";

  return {
    element : el,
    position : function (x, y){
      if (!arguments.length){
        return {
          x : parseInt(style.left, 10),
          y : parseInt(style.top, 10)
        }
      } 
      style.top = y + "px";
      style.left = x + "px";
    },
    size : function (x, y){
      if (!arguments.length){
        return {
          x : parseInt(style.width, 10),
          y : parseInt(style.height, 10)
        }
      } 
      style.height = y + "px";
      style.width = x + "px";
    },
    addBox : function (box){
      box.appendToElement(el);
    },
    addElement : function (element){
      el.appendChild(element);
    },
    appendToElement : function (element){
      element.appendChild(el);
    }
  }

}

function createAceInstance (element){
  var editor = ace.edit(element);
  editor.getSession().setMode('ace/mode/markdown');
  editor.setTheme('ace/theme/monokai');
  editor.setShowPrintMargin(false);
  return editor;
}

function deleteChildren (node){
  var fn = function (){ this.remove(); this.onclick = null; };
  var fns = [];
  forEach.call( node.childNodes , function (node){ 
    fns.push(fn.bind(node))
  });
  forEach.call(fns, function(fn){fn()});
}

function insertText (node, text){
  node.appendChild(document.createTextNode(text));
}

function makeEditSessionActive (entity){

  var session;

  session = editSessions[entity.href];

  forEach.call(content.querySelectorAll('ul.tab-bodies li'), function (li){
    li.style.display = 'none';
  });

  forEach.call(content.querySelectorAll('ul.tabs li.active'), function (li){
    li.className = li.className.replace('active', '');
  });

  session.tab.style.display = 'block';
  session.tabHeader.className += "active";

}

function editFile (entity){

  var session;

  if (!editSessions[entity.href]){
    session = createEditSession(entity);
  } else {
    session = editSessions[entity.href];
  }

  loadFile(entity.href, function (err, response){

    var originalValue = response; 
    session.editor.setValue(originalValue);

    session.editor.getSession().on('change', function (e){
      var currentValue = session.editor.getValue();
      if (currentValue !== originalValue){
        session.tabHeader.querySelector('a').innerText = session.entity.name + " * " 
      } else {
        session.tabHeader.querySelector('a').innerText = session.entity.name
      }
    })

    forEach.call(content.querySelectorAll('ul.tab-bodies li'), function (li){
      li.style.display = 'none';
    });

    forEach.call(content.querySelectorAll('ul.tabs li.active'), function (li){
      li.className = li.className.replace('active', '');
    });

    session.tab.style.display = 'block';
    session.tabHeader.className += "active";

  });

}

function createEditSession (entity){

  var path = entity.href;

  var container = domify('<li></li>');
  var tabHeader = domify('<li><a href="#">' + entity.name +'</a><span class="typcn typcn-delete"><span></li>');
  tabHeader.querySelector('a').onclick = makeEditSessionActive.bind({}, entity);
  content.querySelector('ul.tabs').appendChild(tabHeader);

  var size = getContentViewSize();

  var tabBody = createBox('edit-window');
  tabBody.size(size.x, size.y - size.headerHeight);
  tabBody.position(0, size.headerHeight);
  tabBody.appendToElement(container);
  content.querySelector('ul.tab-bodies').appendChild(container);

  var editor = ace.edit(tabBody.element);
  if (entity.name.match(/\.md$/)){
  editor.getSession().setMode('ace/mode/markdown');
  } else {
    editor.getSession().setMode('ace/mode/json');
  }
  editor.setTheme('ace/theme/monokai');
  editor.setShowPrintMargin(false);

  editSessions[path] = {
    editor : editor,
    path : path,
    box : tabBody,
    tab : container,
    entity : entity,
    tabHeader : tabHeader
  }

  return editSessions[path];

}

function loadFile(path, callback){
    request
    .get(path)
    .accept('text/plain')
    .end(function (err, response){

      callback(err, response.text);

    });
}

function loadDirectory(path){
  request
    .get(path)
    .end(function (err, response){

      var reference = getDirectoryReference(path);
      updateFileSystem(path, response.body);
      renderCurrentDirectory(reference);

    });
}

function getDirectoryReference(path){
    // pop off the first and last

  path = path.replace(vfsRoot, '');

  var pathChunks = path.split('/');
  var pointer = fileSystem;

  pathChunks.shift(); 
  pathChunks.pop();
  pathChunks.unshift('root');

  pathChunks.forEach(function (chunk){
    if (pointer.children[chunk]){
      pointer.children[chunk].parent = pointer;
      pointer = pointer.children[chunk];
    } else {
      throw new Error('omg');
    }
  });

  return pointer;

}

function updateFileSystem(path, entities){

  var pointer = getDirectoryReference(path);

  pointer.entities.splice(0, pointer.entities.length);

  entities.forEach(function (entity){
    if (entity.mime === "inode/directory"){
      if (!pointer.children[entity.name]){
        pointer.children[entity.name] = {
          name : entity.name,
          href : entity.href,
          entities : [],
          children : {}
        }
      }
    } else {
      // add it as an entity...
      pointer.entities.push(entity);

    }
    
  });
}

function renderCurrentDirectory(data){

  var container = files;
  deleteChildren(container);

  var li = document.createElement('li');
  var h3 = document.createElement('h3');
  li.appendChild(h3)
  insertText(h3, data.name);
  container.appendChild(li);

  if (data.parent && data.parent.name){

    var li = document.createElement('li');
    var a = document.createElement('a');
    li.appendChild(a)

    insertText(a, 'Back up to ' + data.parent.name );
    a.onclick = loadDirectory.bind({}, data.parent.href);
    container.appendChild(li);
  }

  for (var child in data.children){
    if (data.children.hasOwnProperty(child)){
      var li = document.createElement('li');
      var a = document.createElement('a');
      a.setAttribute('href', '#');
      insertText(a, data.children[child].name);
      a.onclick = loadDirectory.bind({}, data.children[child].href);
      li.appendChild(domify('<span class="typcn typcn-folder"><span>'))
      li.appendChild(a);
      container.appendChild(li);
    }
  }

  data.entities.forEach(function (entity){

    var li = document.createElement('li');
    var a = document.createElement('a');
    a.setAttribute('href', '#');
    insertText(a, entity.name);
    a.onclick = editFile.bind({}, entity);
    li.appendChild(domify('<span class="typcn typcn-document-text"><span>'))
    li.appendChild(a);
    container.appendChild(li);

  })

}

loadDirectory(fileSystem.children.root.href);
