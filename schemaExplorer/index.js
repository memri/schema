const fs = require('fs');
const path = require('path');
const {readdir} = require('fs').promises;
const express = require('express');
const exphbs = require('express-handlebars');

// Express + Handlebars
const app = express();
const port = 3000;
app.engine('.hbs', exphbs({
  helpers: {
    log: function (value) {
      console.log(value);
    },
  },
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  extname: '.hbs'
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.resolve(__dirname + '/public')));

const typeHierarchyPath = path.resolve('../typeHierarchy');
const dataFiles = ['description.md', 'properties.txt'];

function addToHierarchyFromFile(typeHierarchy, type, dir, dirent) {
  let value = fs.readFileSync(path.resolve(dir, dirent.name), 'utf8', function (err, data) {
  });
  if (dirent.name === 'properties.txt') {
    value = value.split('\n').filter(function (e) {
      return e !== '';
    });
  }
  typeHierarchy[type] = typeHierarchy[type] || {};
  typeHierarchy[type][dirent.name.split('.')[0]] = value;
}

async function getTypeHierarchy(dir, typeHierarchy) {
  const dirents = await readdir(dir, {withFileTypes: true});
  for (const dirent of dirents) {
    let type = dir.split(typeHierarchyPath)[1];
    if (dirent.isDirectory()) {
      typeHierarchy[type] = typeHierarchy[type] || {};
      typeHierarchy[type]['children'] = typeHierarchy[type]['children'] || []
      typeHierarchy[type]['children'].push(dirent.name)
      await getTypeHierarchy(path.resolve(dir, dirent.name), typeHierarchy);
    } else if (dataFiles.includes(dirent.name)) {
      addToHierarchyFromFile(typeHierarchy, type, dir, dirent);
    }
  }
}

function getAncestry(path) {
  let ancestry = {};
  for (let i = 1; i < path.length; i++) {
    ancestry[path[i]] = (path.slice(0, i + 1).join('/'));
  }
  return ancestry;
}

let typeHierarchy = {};
(async () => {
  await getTypeHierarchy(typeHierarchyPath, typeHierarchy);
})();

app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err);
  }
  console.log(`server is listening on http://localhost:${port}`);
});

app.get('/', (request, response) => {
  response.redirect('/thing');
});

app.get('/*', (request, response) => {
  let path = request.originalUrl;
  let pathList = path.split('/');
  pathList.shift();
  if (!Object.keys(typeHierarchy).includes(path)) {
    response.render('404', {name: path});
  } else {
    response.render('home', {
      name: pathList.slice(-1)[0],
      path: path,
      pathLinks: getAncestry(path.split('/')),
      data: typeHierarchy,
    });
  }
});
