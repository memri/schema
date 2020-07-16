const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const predicateHierarchyPath = path.resolve('../predicateHierarchy/predicate');

let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'predicate');

  for (const field of Object.entries(predicateHierarchy)) {
    let output = {
      'description': field[1]['description'],
      'type': field[1]['expectedTypes'],
    };

    output = JSON.stringify(output, null, 2);
    let outputFile = `../predicateHierarchy/${field[1]['path']}/${field[0]}.json`;
    fs.writeFile(outputFile, output, (err) => {
      if (err) throw err;
      console.log('File saved as ' + outputFile);
    });
  }
})();
