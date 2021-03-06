const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../TypeHierarchy/Item');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');
const outputFile = process.env.INDEXER_SCHEMA_OUT != undefined ? process.env.INDEXER_SCHEMA_OUT : './schema.py';

function getItemClasses() {
  let attributesItem = entityHierarchy['Item']['properties'].concat(Object.keys(entityHierarchy['Item']['relations']));
  let itemArguments = "";
  let itemClasses = [];
  let items = Object.keys(entityHierarchy).sort();
  items.sort(function(x,y){ return x === "Item" ? -1 : y === "Item" ? 1 : 0; });
  for (const item of items) {
    if (['SyncableItem', 'Edge', 'Datasource', 'UserState', 'ViewArguments', 'CVUStateDefinition'].includes(item)) continue;

    let classDescription = `\n# ${entityHierarchy[item]['description']}\n`;
    classDescription = helpers.wrapText(`# ${entityHierarchy[item]['description']}`, 100, '\n# ');

    let ancestry = helpers.getAncestry(entityHierarchy[item]['path'].split('/'));
    let properties = [], edges = [];
    for (const _item in ancestry) {
      properties = properties.concat(entityHierarchy[_item]['properties']);
      edges = edges.concat(Object.keys(entityHierarchy[_item]['relations']));
    }

    let arguments = "", clsArguments = "";
    let attributes = [], fromJsonEdges = [], fromJsonProperties = [], fromJsonEdgeLoop = [];
    for (const attribute of properties.concat(edges)) {
      if (['genericType', 'functions', 'updatedFields', 'allEdges'].includes(attribute)) continue;
      arguments += `${arguments === '' ? '' : ', '}${attribute}=None`;
      clsArguments += `${clsArguments === '' ? '' : ', '}${attribute}=${attribute}`;
      if (item === 'Item') itemArguments += `${itemArguments === '' ? '' : ', '}${attribute}=${attribute}`;
      if (item === 'Item' && attribute === 'uid') continue

      if (properties.includes(attribute)) {
        fromJsonProperties.push(`${attribute} = json.get("${attribute}", None)`);
      } else {
        fromJsonEdges.push(`${attribute} = []`)
        let ifOrElif = fromJsonEdgeLoop.length === 0 ? 'if' : 'elif';
        fromJsonEdgeLoop.push(`${ifOrElif} edge._type == "${attribute}" or edge._type == "~${attribute}": 
                    ${attribute}.append(edge)`)
      }
      if (attributesItem.includes(attribute) && item !== 'Item') continue;
      if (edges.includes(attribute)) {
        attributes.push(`self.${attribute} = ${attribute} if ${attribute} is not None else []`);
      } else {
        attributes.push(`self.${attribute} = ${attribute}`);
      }
    }
    let dataItemClass;
    if (item === 'Item') {
      dataItemClass = `

${classDescription}
class Item(ItemBase):
    ${helpers.wrapText(`def __init__(self, ${arguments})`, 100, '\n' + ' '.repeat(17))}:
        super().__init__(uid)
        ${helpers.insertList(attributes, 8)}`;
    } else {
      dataItemClass = `

${classDescription}
class ${item}(Item):
    ${helpers.wrapText(`def __init__(self, ${arguments})`, 100, '\n' + ' '.repeat(17))}:
        ${helpers.wrapText(`super().__init__(${itemArguments})`, 100, '\n' + ' '.repeat(25))}
        ${helpers.insertList(attributes, 8)}

    @classmethod
    def from_json(cls, json):
        all_edges = json.get("allEdges", None)
        ${helpers.insertList(fromJsonProperties, 8)}
       
        ${helpers.insertList(fromJsonEdges,8)}
        
        if all_edges is not None:
            for edge_json in all_edges:
                edge = Edge.from_json(edge_json)
                ${helpers.insertList(fromJsonEdgeLoop,16)}
        
        ${helpers.wrapText(`res = cls(${clsArguments}`, 100, '\n' + ' '.repeat(18))})
        for e in res.get_all_edges(): e.source = res
        return res`;
    }
    itemClasses.push(dataItemClass);
  }
  return itemClasses;
}

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');

  const itemClasses = getItemClasses();
  const output = `#
#  WARNING: THIS FILE IS AUTOGENERATED; DO NOT CHANGE.
#  Visit https://gitlab.memri.io/memri/schema to learn more.
#
#  schema.py
#
#  Copyright © 2020 memri. All rights reserved.
#

from .itembase import ItemBase, Edge


def get_constructor(_type, indexer_class=None):
    import integrators.indexers as models
    from integrators.indexers.indexer import IndexerBase
    import integrators.integrator_registry

    if _type == "Indexer" and indexer_class is not None and hasattr(integrators.integrator_registry, indexer_class):
        return getattr(integrators.integrator_registry, indexer_class)

    classes = z = {**globals(), **locals()}
    if _type in classes:
        if _type == "Indexer":
            constructor = classes[indexer_class]
        else:
            constructor = classes[_type]
    else:
        raise TypeError
    return constructor
${helpers.insertList(itemClasses, 0)}`;

  fs.writeFile(outputFile, output, (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();