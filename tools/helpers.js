const fs = require('fs');
const {readdir} = require('fs').promises;
const path = require('path');

const DATA_FILES = ['description.md', 'properties.txt', 'expectedTypes.txt'];

function path2dir(filePath) {
  if (!filePath.split('/').slice(-1)[0]) {
    return 'entity';
  }
  return filePath.split('/').slice(-1)[0];
}

function addToHierarchyFromFile(hierarchy, filePath, dir, dirent) {
  let value = fs.readFileSync(path.resolve(dir, dirent.name), 'utf8', function (err, data) {
  });
  // Splits .txt files on newlines to parse properties and expectedTypes.
  if (dirent.name.split('.')[0] === 'properties') {
    value = value.split('\n').filter(function (e) {
      return e !== '';
    });
  }
  hierarchy[path2dir(filePath)] = hierarchy[path2dir(filePath)] || {};
  hierarchy[path2dir(filePath)][dirent.name.split('.')[0]] = value;
  hierarchy[path2dir(filePath)]['path'] = 'entity' + filePath || 'entity';
}

async function getHierarchy(dir, hierarchy, splitPath) {
  // Recursively read the directory structure.
  const dirents = await readdir(dir, {withFileTypes: true});
  for (const dirent of dirents) {
    let filePath = dir.split(splitPath)[1];
    if (dirent.isDirectory()) {
      hierarchy[path2dir(filePath)] = hierarchy[path2dir(filePath)] || {};
      hierarchy[path2dir(filePath)]['children'] = hierarchy[path2dir(filePath)]['children'] || [];
      hierarchy[path2dir(filePath)]['children'].push(dirent.name);
      await getHierarchy(path.resolve(dir, dirent.name), hierarchy, splitPath);
    } else if (DATA_FILES.includes(dirent.name)) {
      addToHierarchyFromFile(hierarchy, filePath, dir, dirent);
    }
  }
}

module.exports = {
  getHierarchy
}
