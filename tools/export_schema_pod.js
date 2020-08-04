const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../TypeHierarchy/Item');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');
const outputFile = './autogenerated_database_schema.json';

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');

  let types = [];
  for (const entity of Object.keys(entityHierarchy).sort()) {
    if (['Item', 'SyncableItem', 'Edge'].includes(entity)) continue;
    let ancestry = helpers.getAncestry(entityHierarchy[entity]['path'].split('/'));

    let propertiesIncludingInherited = [];
    for (const _entity in ancestry) {
      propertiesIncludingInherited.push(entityHierarchy[_entity]['properties']);
    }

    let properties = [];
    for (const property of propertiesIncludingInherited.flat().sort()) {
      if (predicateHierarchy[property]) {
        let dbtype;
        switch (predicateHierarchy[property]['type']) {
          case 'string':
            dbtype = 'Text';
            break;
          case 'int':
            dbtype = 'Integer';
            break;
          case 'bool':
            dbtype = 'Bool';
            break;
          case 'float':
            dbtype = 'Real';
            break;
          case 'datetime':
          case 'date':
            dbtype = 'DateTime';
            break;
          default:
            dbtype = false;
        }
        if (dbtype) {
          properties.push({'name': property, 'dbtype': dbtype, 'indexed': false});
        }
      }
    }
    types.push({'name': entity, 'properties': properties});
  }

  fs.writeFile(outputFile, JSON.stringify({'types': types}, null, 2), (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();
