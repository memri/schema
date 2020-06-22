const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../entityHierarchy/thing/entity');
const predicateHierarchyPath = path.resolve('../predicateHierarchy');
const outputFile = './schema.swift';

// const primitiveTypes = ['bool', 'int', 'float', 'string', '[string]', 'datetime'];

function getHeader() {
  return "//\
          //  schema.swift\
          //  memri\
          //\
          //  Created by Ruben Daniels on 4/1/20.\
          //  Copyright © 2020 memri. All rights reserved.\
          //\
          \
            import Foundation\
            import Combine\
            import SwiftUI\
            import RealmSwift\
          \
            public typealias List = RealmSwift.List"
}

function getDataItemFamily() {
  let output = "// The family of all data item classes\
                enum DataItemFamily: String, ClassFamily, CaseIterable {"
  console.log(entityHierarchy);
  // for (const type)
}


let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath);
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath);

  let output = getHeader();
  output += getDataItemFamily();

  fs.writeFile(outputFile, output, (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();
