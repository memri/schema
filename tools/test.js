const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../TypeHierarchy/Item');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');

  console.log('\nCheck if properties of entities exist...');
  for (const entity of Object.keys(entityHierarchy)) {
    for (let property of entityHierarchy[entity]['properties']) {
      if (!Object.keys(predicateHierarchy).includes(property)) {
        console.log(`E: Type: '${entity}', has non-existent property: '${property}'`);
      }
    }
  }

  console.log('\nCheck if relations of entities exist...');
  for (const entity of Object.keys(entityHierarchy)) {
    for (let relation of Object.keys(entityHierarchy[entity]['relations'])) {
      if (!Object.keys(predicateHierarchy).includes(relation)) {
        console.log(`E: Type: '${entity}', has non-existent relation: '${relation}'`);
      }
    }
  }

  console.log('\nCheck if types of predicates exist...');
  for (const predicate of Object.keys(predicateHierarchy)) {
    if (predicateHierarchy[predicate]['type']) {
      let type = predicateHierarchy[predicate]['type'];
      if (!Object.keys(entityHierarchy).includes(type) && !helpers.PRIMITIVE_TYPES.includes(type) && type !== 'any') {
        console.log(`E: Edge / Property: '${predicateHierarchy[predicate]['path']}', expects non-existent type: '${type}'`);
      }
    } else {
      if (!predicateHierarchy[predicate]['children']) {
        console.log(`E: Edge / Property: '${predicateHierarchy[predicate]['path']}', has no type.`);
      }
    }
  }

  console.log('\nCheck for duplicate properties and edges (inherited and redefined)...');
  for (const [entityName, entity] of Object.entries(entityHierarchy)) {
    if (['Edge', 'UserState', 'ViewArguments'].includes(entityName)) continue;
    let ancestry = helpers.getAncestry(entity['path'].split('/'));
    delete ancestry[entityName];
    const propertiesAndEdges = entity['properties'].concat(Object.keys(entity['relations']));
    for (const ancestor of Object.keys(ancestry)) {
      const ancestorFields = entityHierarchy[ancestor]['properties'].concat(Object.keys(entityHierarchy[ancestor]['relations']));
      for (const field of propertiesAndEdges) {
        if (ancestorFields.includes(field)) {
          console.log(`E: ${entityName} redefines ${field} that is already in ${ancestor}.`);
        }
      }
    }
  }

  console.log('\nCheck for unused Items...');
  let usedTypes = new Set();
  for (const predicate of Object.values(predicateHierarchy)) {
    if (predicate['type']) usedTypes.add(predicate['type']);
  }
  for (const entity of Object.keys(entityHierarchy)) {
    if (!usedTypes.has(entity)) {
      console.log(`W: No Edge uses Item ${entity}`);
    }
  }

  console.log('\nCheck for unused Edges...');
  let usedEdges = new Set();
  for (const entity of Object.values(entityHierarchy)) {
    for (const relation of Object.keys(entity['relations'])) {
      usedEdges.add(relation);
    }
  }
  for (const edge of Object.keys(predicateHierarchy)) {
    if (!(usedEdges.has(edge) || helpers.PRIMITIVE_TYPES.includes(predicateHierarchy[edge]['type']))) {
      console.log(`W: No Item uses Edge ${edge}`);
    }
  }

  console.log('\nCheck for TBDs...');
  for (const entity of Object.keys(entityHierarchy)) {
    if (entityHierarchy[entity]['description']) {
      if (entityHierarchy[entity]['description'].toLowerCase().includes('tbd')) {
        console.log(`W: Item ${entity} has TBD in description.`);
      }
    } else {
      console.log(`W: Item ${entity} is missing a description.`);
    }
  }
  for (const predicate of Object.keys(predicateHierarchy)) {
    if (predicateHierarchy[predicate]['description']) {
      if (predicateHierarchy[predicate]['description'].toLowerCase().includes('tbd')) {
        console.log(`W: Edge / Property ${predicate} has TBD in description.`);
      }
    } else {
      console.log(`W: Edge / Property ${predicate} is missing a description.`);
    }
  }

// TODO check if properties are shared over all children of an Item, so they could be inherited
})();