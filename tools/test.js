const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../TypeHierarchy/Item');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');

  console.log('Check if properties of entities exist...');
  for (const entity of Object.keys(entityHierarchy)) {
    for (let property of entityHierarchy[entity]['properties']) {
      if (!Object.keys(predicateHierarchy).includes(property)) {
        console.log(`-> Type: '${entity}', has non-existent property: '${property}'`);
      }
    }
  }

  console.log('Check if relations of entities exist...');
  for (const entity of Object.keys(entityHierarchy)) {
    for (let relation of Object.keys(entityHierarchy[entity]['relations'])) {
      if (!Object.keys(predicateHierarchy).includes(relation)) {
        console.log(`-> Type: '${entity}', has non-existent relation: '${relation}'`);
      }
    }
  }

  console.log('Check if types of predicates exist...');
  for (const predicate of Object.keys(predicateHierarchy)) {
    if (predicateHierarchy[predicate]['type']) {
      let type = predicateHierarchy[predicate]['type'];
      if (!Object.keys(entityHierarchy).includes(type) && !helpers.PRIMITIVE_TYPES.includes(type) && type !== 'any') {
        console.log(`-> Edge / Property: '${predicateHierarchy[predicate]['path']}', expects non-existent type: '${type}'`);
      }
    } else {
      if (!predicateHierarchy[predicate]['children']) {
        console.log(`-> Edge / Property: '${predicateHierarchy[predicate]['path']}', has no type.`);
      }
    }
  }

  console.log('Check for duplicate properties and edges (inherited and redefined)...');
  for (const entity of Object.keys(entityHierarchy)) {
    if (entityHierarchy[entity]['children']) {
      const fields = entityHierarchy[entity]['properties'].concat(Object.keys(entityHierarchy[entity]['relations']))
      for (const child of entityHierarchy[entity]['children']) {
        const childFields = entityHierarchy[child]['properties'].concat(Object.keys(entityHierarchy[child]['relations']))
        for (const childField of childFields) {
          if (fields.includes(childField)) {
            console.log(`-> ${child} redefines ${childField} that is already in ${entity}.`)
          }
        }
      }
    }
  }

  // TODO check if lower cased properties and relations don't clash: they can't have different types
  // TODO check if props are `double`, i.e. already inherited
  // TODO check if there are unused Items
  // TODO check if there are unused relationships/properties
  // TODO check if properties are shared over all children of an Item, so they could be inherited
})();
