const fs = require('fs');
const {readdir} = require('fs').promises;
const path = require('path');

const PRIMITIVE_TYPES = ['bool', 'int', 'float', 'string', 'datetime'];

function path2dir(filePath, hierarchyType) {
  if (!filePath.split((/[\\\/]/)).slice(-1)[0]) {
    return hierarchyType;
  }
  return filePath.split((/[\\\/]/)).slice(-1)[0];
}

async function getHierarchy(dir, hierarchy, rootDir, hierarchyType) {
  // Recursively read json files from the directory tree, which is also the hierarchy.
  const dirents = await readdir(dir, {withFileTypes: true});
  for (const dirent of dirents) {
    let filePath = dir.split(rootDir)[1];
    if (dirent.isDirectory()) {
      hierarchy[path2dir(filePath, hierarchyType)] = hierarchy[path2dir(filePath, hierarchyType)] || {};
      hierarchy[path2dir(filePath, hierarchyType)]['children'] = hierarchy[path2dir(filePath, hierarchyType)]['children'] || [];
      hierarchy[path2dir(filePath, hierarchyType)]['children'].push(dirent.name);
      await getHierarchy(path.resolve(dir, dirent.name), hierarchy, rootDir, hierarchyType);
    } else if (dirent.name.split('.')[1] === 'json') {
      if (dir.split('/').splice(-1)[0] !== dirent.name.split('.')[0] && filePath !== '') {
        console.log(`E: Directory '${dir.split('/').splice(-1)[0]}' and json name '${dirent.name}' do not match`);
      }
      let data = fs.readFileSync(`${dir}/${dirent.name}`);
      hierarchy[path2dir(filePath, hierarchyType)] = {...hierarchy[path2dir(filePath, hierarchyType)], ...JSON.parse(data)};
      hierarchy[path2dir(filePath, hierarchyType)]['path'] = hierarchyType + filePath || hierarchyType;
    }
  }
}

function wrapText(str, width, spaceReplacer) {
  spaceReplacer = spaceReplacer || '\n    /// ';
  if (str.length > width) {
    let p = width;
    for (; p > 0 && str[p] !== ' '; p--) {
    }
    if (p > 0) {
      let left = str.substring(0, p);
      let right = str.substring(p + 1);
      return left + spaceReplacer + wrapText(right, width, spaceReplacer);
    }
  }
  return str;
}

function getAncestry(path) {
  // Returns ancestry of a node in the hierarchy as a mapping from the node name to the node path,
  // e.g. '/TypeHierarchy/Item' -> { TypeHierarchy: '/TypeHierarchy', Item: '/TypeHierarchy/Item' }
  let ancestry = {};
  for (let i = 0; i < path.length; i++) {
    ancestry[path[i]] = (path.slice(0, i + 1).join('/'));
  }
  return ancestry;
}

function insertList(content, indent) {
  let output = '';
  for (const [i, line] of content.entries()) {
    if (i !== 0) output += ' '.repeat(indent);
    output += line;
    if (i !== (content.length - 1)) output += '\n';
  }
  return output;
}

module.exports = {
  getHierarchy,
  wrapText,
  getAncestry,
  insertList,
  PRIMITIVE_TYPES
};
