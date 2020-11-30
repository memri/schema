const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../TypeHierarchy/Item');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');
const outputFile = './schema.json';
const outputFileCommented = './schema.hjson';

function getDataItemClasses(commented) {
  let propertiesAndRelationsItem = entityHierarchy['Item']['properties'].concat(Object.keys(entityHierarchy['Item']['relations']));
  let dataItemClasses = [];
  for (const entity of Object.keys(entityHierarchy).sort()) {
    if (['Datasource', 'UserState', 'ViewArguments', 'CVUStateDefinition'].includes(entity)) continue;

    // Inheritance
    let ancestry = helpers.getAncestry(entityHierarchy[entity]['path'].split('/'));
    let propertiesAndRelations = [];
    if (entity === 'Edge') {
      propertiesAndRelations = propertiesAndRelations.concat(entityHierarchy[entity]['properties']);
      propertiesAndRelations = propertiesAndRelations.concat(Object.keys(entityHierarchy[entity]['relations']));
    } else {
      for (const _item in ancestry) {
        propertiesAndRelations = propertiesAndRelations.concat(entityHierarchy[_item]['properties']);
        propertiesAndRelations = propertiesAndRelations.concat(Object.keys(entityHierarchy[_item]['relations']));
      }
    }

    let properties = "";
    for (const field of propertiesAndRelations) {
      // Skip certain properties
      if (['genericType', 'functions', 'updatedFields'].includes(field)) continue;
      if (propertiesAndRelationsItem.includes(field) && !['Item', 'Edge'].includes(entity)) continue;
      if (['Item', 'Edge'].includes(entity)) continue;

      if (Object.keys(predicateHierarchy).includes(field)) {
        let type = predicateHierarchy[field]['type'];
        if (entity === 'Item' && !helpers.PRIMITIVE_TYPES.includes(type) && field !== 'allEdges') {
          continue
        }

        if (type === 'any') {
          continue
        }

        if (commented) {
          if (field === 'syncState' || helpers.PRIMITIVE_TYPES.includes(type) || type === 'Edge') {
            properties += helpers.wrapText(`    /// ${entity}.${field}: ${predicateHierarchy[field]['description']}\n`, 96);
          } else if (!['changelog', 'label'].includes(field)) {
            properties += helpers.wrapText(`    /// ${entity}.${field}: ${predicateHierarchy[field]['description']}\n`, 96);
          }
      }
        properties += `    { "item_type": "${entity}", "property": "${field}", "property_type": "${type}" },\n`;
      }
    }

    dataItemClasses.push(properties);
  }
  return dataItemClasses;
}


let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');

  const output = `{
  "types": [
${helpers.insertList(getDataItemClasses(false))}
  ]
}
`;

const outputCommented = `//
//  WARNING: THIS FILE IS AUTOGENERATED; DO NOT CHANGE.
//  Visit https://gitlab.memri.io/memri/schema to learn more.
//
//  schema.hjson
//
//  Copyright © 2020 memri. All rights reserved.
//
{
  "types": [
${helpers.insertList(getDataItemClasses(true))}
  ]
}
`;

fs.writeFile(outputFile, output, (err) => {
  if (err) throw err;
  console.log('File saved as ' + outputFile);
});
fs.writeFile(outputFileCommented, outputCommented, (err) => {
  if (err) throw err;
  console.log('File (with comments) saved as ' + outputFileCommented);
});
})();
