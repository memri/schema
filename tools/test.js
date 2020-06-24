const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../entityHierarchy/thing/Entity');
const predicateHierarchyPath = path.resolve('../predicateHierarchy/predicate');

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Entity');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'predicate');

  console.log('Check if all properties of entities exist...');
  for (entity of Object.keys(entityHierarchy)) {
    for (const property of entityHierarchy[entity]['properties']) {
      if (!Object.keys(predicateHierarchy).includes(property)) {
        console.log(`-> Entity: '${entity}', has non-existent property: '${property}'`);
      }
    }
  }

  console.log('Check if all expected types of predicates exist...');
  for (predicate of Object.keys(predicateHierarchy)) {
    if (predicateHierarchy[predicate]['expectedTypes']) {
      let expectedTypes = predicateHierarchy[predicate]['expectedTypes'].split('\n');
      for (const expectedType of expectedTypes) {
        if (!Object.keys(entityHierarchy).includes(expectedType) && !helpers.PRIMITIVE_TYPES.includes(expectedType)) {
          console.log(`-> Predicate: '${predicateHierarchy[predicate]['path']}', expects non-existent type: '${expectedType}'`);
        }
      }
    } else {
      console.log(`-> Predicate: '${predicateHierarchy[predicate]['path']}', has no expected types`);
    }
  }

  // TODO check if a predicate expects all types that its children predicates expect.
})();
