const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../entityHierarchy/thing/Item');
const predicateHierarchyPath = path.resolve('../predicateHierarchy/predicate');
const outputFile = './database_schema.json';

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'predicate');
  console.log(entityHierarchy);
  console.log(predicateHierarchy);

  let types = [];
  for (const entity of Object.keys(entityHierarchy)) {
    if (entity === 'Item') { // TODO not hard coded
      continue
    }
    let columns = [];
    console.log(entity)
    if (entityHierarchy[entity]) {
      console.log(entityHierarchy[entity])
      for (const predicate of entityHierarchy[entity]['properties']) {
        if (predicateHierarchy[predicate]) {
          let _type;
          switch (predicateHierarchy[predicate]['expectedTypes']) {
            case 'string':
              _type = 'Text'
              break;
            case 'int':
            case 'bool': // in SQLite booleans are implemented as integers (where 0/1 == false/true)
              _type = 'Integer'
              break;
            case 'float':
              _type = 'Real'
              break;
            default:
              _type = false
          }
          if (_type) {
            columns.push({'name': predicate, '_type': _type, 'indexed': false})
          }
        }
      }
      console.log(columns)
    }
    types.push({'name': entity, 'columns': columns})
  }

  let output = {'types': types}
  console.log(output)

  fs.writeFile(outputFile, JSON.stringify(output, null, 2), (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})()
