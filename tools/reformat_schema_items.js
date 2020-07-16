const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../entityHierarchy/thing/Item');
const predicateHierarchyPath = path.resolve('../predicateHierarchy/predicate');

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'predicate');

  for (const entity of Object.entries(entityHierarchy)) {
    let properties = [];
    let relations = {};
    for (let propertyOrRelation of entity[1]['properties']) {
      let sequenced = false;
      if (propertyOrRelation.substring(0, 10) === 'sequenced_') {
        propertyOrRelation = propertyOrRelation.substring(10);
        sequenced = true;
      }
      let singular = false;
      if (propertyOrRelation.substring(0, 4) === 'one_') {
        propertyOrRelation = propertyOrRelation.substring(4);
        singular = true;
      }
      let type = predicateHierarchy[propertyOrRelation]['expectedTypes'];
      if (helpers.PRIMITIVE_TYPES.includes(type)) {
        properties.push(propertyOrRelation);
      } else {
        relations[propertyOrRelation] = {'sequenced': sequenced, 'singular': singular};
      }
    }

    let output = {
      'description': entity[1]['description'],
      'properties': properties,
      'relations': relations,
      'foregroundColor': entity[1]['foregroundColor'],
      'backgroundColor': entity[1]['backgroundColor']
    };

    output = JSON.stringify(output, null, 2);
    let outputFilePath = `../entityHierarchy/thing/${entity[1]['path']}/${entity[0]}.json`;
    fs.writeFile(outputFilePath, output, (err) => {
      if (err) throw err;
      console.log('File saved as ' + outputFilePath);
    });
  }
})();
