const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../entityHierarchy/thing/Entity');
const predicateHierarchyPath = path.resolve('../predicateHierarchy');
const outputFile = './schema_definition.rs';

function getEdgeProps() {
  const predicates = Object.keys(predicateHierarchy);
  let output = "";
  let length = 0;
  for (const predicate of predicates) {
    if (!helpers.PRIMITIVE_TYPES.includes(predicateHierarchy[predicate]['expectedTypes'])) {
      // TODO create better abstraction for 1:1 VS 1:many
      if (predicateHierarchy[predicate]['expectedTypes'] === 'uid') {
        output += "        \"" + predicate + ": uid \",\n";
      } else {
        output += "        \"" + predicate + ": [uid] \",\n";
      }
      length += 1;
    }
  }
  output += "    ];\n    edge_props\n}\n\n";
  let firstLine = "pub fn get_edge_props() -> [&'static str; " + length + "] {" +
    "\n    let edge_props: [&str;" + length + "] = [\n";
  return firstLine + output;
}

function getStringProps() {
  let output = "pub fn get_string_props() -> Vec<&'static str> {\n    let string_props: Vec<&str> = vec![\n";
  const predicates = Object.keys(predicateHierarchy);
  for (const predicate of predicates) {
    if (predicateHierarchy[predicate]['expectedTypes'] === 'string') {
      output += "        \"" + predicate + "\",\n";
    }
  }
  output += "    ];\n    string_props\n}\n\n";
  return output;
}

function getOtherProps() {
  let output = "pub fn get_other_props() -> Vec<&'static str> {\n    let other_props: Vec<&str> = vec![\n";
  const predicates = Object.keys(predicateHierarchy);
  for (const predicate of predicates) {
    if (helpers.PRIMITIVE_TYPES.includes(predicateHierarchy[predicate]['expectedTypes']) &&
      predicateHierarchy[predicate]['expectedTypes'] !== 'string') {
      let expectedType;
      switch (predicateHierarchy[predicate]['expectedTypes']) {
        case 'bool':
          expectedType = 'bool';
          break;
        case 'int':
          expectedType = 'int @index(int)';
          break;
        case 'float':
          expectedType = 'float @index(float)';
          break;
        case '[string]':
          expectedType = '[string] @index(term)';
          break;
        default:
          expectedType = predicateHierarchy[predicate]['expectedTypes'];
      }
      output += "        \"" + predicate + ": " + expectedType + " .\",\n";
    }
  }
  output += "    ];\n    other_props\n}\n\n";
  return output;
}

function getAllTypes() {
  let output = "pub fn get_all_types() -> HashMap<&'static str, Vec<&'static str>> {\n" +
    " let mut all_types: HashMap<&str, Vec<&str>> = HashMap::new();\n";
  const entities = Object.keys(entityHierarchy);
  for (const entity of entities) {
    output += "    all_types.insert(\n";
    output += "        \"" + entity + "\",\n        vec![\n";
    let entityTree = entityHierarchy[entity]['path'].split('/');
    for (const entity of entityTree) {
      if (entityHierarchy[entity]['properties']) {
        for (const property of entityHierarchy[entity]['properties']) {
          output += "            \"" + property + "\",\n";
        }
      }
    }
    output += "        ],\n    );\n";
  }
  output += "    all_types\n}\n";
  return output;
}

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath);
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath);

  let output = getEdgeProps();
  output += getStringProps();
  output += getOtherProps();
  output += getAllTypes();

  fs.writeFile(outputFile, output, (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();
