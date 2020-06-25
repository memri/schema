const fs = require('fs');
const {readdir} = require('fs').promises;
const path = require('path');

const DATA_FILES = ['description.md', 'properties.txt', 'expectedTypes.txt'];
const PRIMITIVE_TYPES = ['bool', 'int', 'float', 'string', 'datetime']; // TODO update to match new DB

const ENTITY_HIERARCHY_PATH = path.resolve('../entityHierarchy/thing/Item');
const PREDICATE_HIERARCHY_PATH = path.resolve('../predicateHierarchy');

function path2dir(filePath, hierarchyType) {
  if (!filePath.split('/').slice(-1)[0]) {
    return hierarchyType;
  }
  return filePath.split('/').slice(-1)[0];
}

function addToHierarchyFromFile(hierarchy, filePath, dir, dirent, hierarchyType) {
  let value = fs.readFileSync(path.resolve(dir, dirent.name), 'utf8', function (err, data) {
  });
  // Splits .txt files on newlines to parse properties and expectedTypes.
  if (dirent.name.split('.')[0] === 'properties') {
    value = value.split('\n').filter(function (e) {
      return e !== '';
    });
  }
  hierarchy[path2dir(filePath, hierarchyType)] = hierarchy[path2dir(filePath, hierarchyType)] || {};
  hierarchy[path2dir(filePath, hierarchyType)][dirent.name.split('.')[0]] = value;
  hierarchy[path2dir(filePath, hierarchyType)]['path'] = hierarchyType + filePath || hierarchyType;
}

async function getHierarchy(dir, hierarchy, rootDir, hierarchyType) {
  // Recursively read the directory structure.
  const dirents = await readdir(dir, {withFileTypes: true});
  for (const dirent of dirents) {
    let filePath = dir.split(rootDir)[1];
    if (dirent.isDirectory()) {
      hierarchy[path2dir(filePath, hierarchyType)] = hierarchy[path2dir(filePath, hierarchyType)] || {};
      hierarchy[path2dir(filePath, hierarchyType)]['children'] = hierarchy[path2dir(filePath, hierarchyType)]['children'] || [];
      hierarchy[path2dir(filePath, hierarchyType)]['children'].push(dirent.name);
      await getHierarchy(path.resolve(dir, dirent.name), hierarchy, rootDir, hierarchyType);
    } else if (DATA_FILES.includes(dirent.name)) {
      addToHierarchyFromFile(hierarchy, filePath, dir, dirent, hierarchyType);
    }
  }
}

module.exports = {
  getHierarchy,
  PRIMITIVE_TYPES
};
