const path = require('path');
const express = require('express');
const exphbs = require('express-handlebars');
const helpers = require('./helpers');

const entityHierarchyPath = path.resolve('../TypeHierarchy');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');

// Express + Handlebars app.
const app = express();
const port = 3001;
app.engine('.hbs', exphbs({
  helpers: {
    log: function (value) {
      console.log(value);
    },
    path2name: function (value) {
      return value.split('/').slice(-1)[0];
    }
  },
  defaultLayout: 'main',
  layoutsDir: path.join(__dirname, 'views/layouts'),
  extname: '.hbs'
}));
app.set('view engine', '.hbs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.resolve(__dirname + '/public')));

// Read the hierarchies from files.
let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Type');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');
})();

app.listen(port, (err) => {
  if (err) {
    return console.log('something bad happened', err);
  }
  console.log(`server is listening on http://localhost:${port}`);
});

app.get('/*', (request, response) => {
  let path = request.originalUrl;
  if (path.length > 1 && path.slice(-1) === '/') path = path.slice(0, -1); // remove trailing '/'
  let name = path.split('/').slice(-1)[0];
  let data = {
    name: name,
    path: path,
    pathLinks: helpers.getAncestry(path.substr(1).split('/')),
    entityHierarchy: entityHierarchy,
    predicateHierarchy: predicateHierarchy,
  };
  if (path === '/') {
    response.render('home');
  } else if (Object.keys(entityHierarchy).includes(name)) {
    response.render('entity', data);
  } else if (Object.keys(predicateHierarchy).includes(name)) {
    response.render('predicate', data);
  } else {
    response.render('404', {name: path});
  }
});