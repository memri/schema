const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../TypeHierarchy/Item');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');
const outputFile = './schema.ts';

function getItemFamily() {
  let itemFamily = [], bgColors = [], fgColors = [], typeFunctions = [];
  for (const entity of Object.keys(entityHierarchy)) {
    if (entity === 'Item') continue;
    itemFamily.push(`type${entity} = "${entity}",`);
    bgColors.push(`case ItemFamily.type${entity}: return new Color("${entityHierarchy[entity]['backgroundColor']}")`);
    fgColors.push(`case ItemFamily.type${entity}: return new Color("${entityHierarchy[entity]['foregroundColor']}")`);
    typeFunctions.push(`case ItemFamily.type${entity}: return ${entity}`);
  }
  return [itemFamily, bgColors, fgColors, typeFunctions];
}

function getDataItemClasses() {
  let dataItemClasses = [];
  for (const entity of Object.keys(entityHierarchy)) {
    if (['Datasource', 'UserState', 'ViewArguments'].includes(entity)) continue;

    let classDescription = `\n/// ${entityHierarchy[entity]['description']}\n`;
    classDescription = helpers.wrapText(`/// ${entityHierarchy[entity]['description']}`, 100, '\n/// ');

    let classDefinition;
    switch (entity) {
      case 'Item':
        classDefinition = `export class SchemaItem {`;
        break;
      case 'Session':
        classDefinition = `export class SchemaSession extends Item {`;
        break;
      case 'Sessions':
        classDefinition = `export class SchemaSessions extends Item {`;
        break;
      case 'Person':
        classDefinition = `export class SchemaPerson extends Item {`;
        break;
      case 'SyncState':
        classDefinition = `export class SyncState {\n    updatedFields = []`;
        break;
      case 'Edge':
        classDefinition = `export class Edge {`;
        break;
      default:
        classDefinition = `public class ${entity} extends Item {`;
    }

    let properties = "";
    let propertiesDecoder = "";
    let relations = "";
    let relationsDecoder = "";
    let codingKeys = [];
    let propertiesAndRelations = entityHierarchy[entity]['properties'].concat(Object.keys(entityHierarchy[entity]['relations']));
    let propertiesAndRelationsItem = entityHierarchy['Item']['properties'].concat(Object.keys(entityHierarchy['Item']['relations']));

    for (let field of propertiesAndRelations) {
      if (['genericType', 'functions', 'updatedFields'].includes(field)) continue;
      if (propertiesAndRelationsItem.includes(field) && !['Item', 'Edge'].includes(entity)) continue;

      if (Object.keys(predicateHierarchy).includes(field)) {
        if (!['changelog', 'label'].includes(field)) codingKeys.push(field);

        let type = predicateHierarchy[field]['type'];
        if (field === 'syncState' || helpers.PRIMITIVE_TYPES.includes(type) || type === 'Edge') {
          properties += helpers.wrapText(`    /// ${predicateHierarchy[field]['description']}\n`, 96);
        } else if (!['changelog', 'label'].includes(field)) {
          relations += helpers.wrapText(`    /// ${predicateHierarchy[field]['description']}\n`, 96);
        }

        if (['allEdges', 'currentViewIndex', 'currentSessionIndex', 'version', 'views', 'sessions', 'syncState'].includes(field)) {
          switch (field) {
            case 'allEdges':
              properties += '    allEdges = []\n';
              break;
            case 'currentViewIndex':
            case 'currentSessionIndex':
              properties += `    ${field}: number = 0\n`; // TODO Ani
              propertiesDecoder += `            this.${field} = decoder.decodeIfPresent("${field}") ?? this.${field}\n`;
              break;
            case 'version':
              properties += `    ${field}: number = 0\n`;
              propertiesDecoder += `            this.${field} = decoder.decodeIfPresent("${field}") ?? this.${field}\n`;
              break;
            case 'views': //TODO Ani sorted
              relations += `    get ${field}() {\n` +
                `        return this.edges("view")?.sorted("sequence").items(${type})\n` +
                '    }\n\n';
              break;
            case 'sessions': //TODO Ani sorted
              relations += `    get ${field}() {\n` +
                `        return this.edges("session")?.sorted("sequence").items(${type})\n` +
                '    }\n\n';
              break;
            case 'syncState':
              properties += `    ${field}\n`;
              propertiesDecoder += `            this.${field} = decoder.decodeIfPresent("${field}") ?? this.${field}\n`;
              break;
          }
        } else {
          switch (type) {
            case 'string':
              properties += `    ${field}\n`;
              if (field === 'targetItemType') {
                propertiesDecoder += `            this.${field} = decoder.decodeIfPresent("itemType") ?? this.${field}\n`;
              } else if (field !== 'sourceItemType') {
                propertiesDecoder += `            this.${field} = decoder.decodeIfPresent("${field}") ?? this.${field}\n`;
              }
              break;
            case 'datetime':
              properties += `    ${field}: Date\n`;
              propertiesDecoder += `            this.${field} = decoder.decodeIfPresent("${field}") ?? this.${field}\n`;
              break;
            case 'bool':
              properties += `    ${field}: boolean = false\n`;
              propertiesDecoder += `            this.${field} = decoder.decodeIfPresent("${field}") ?? this.${field}\n`;
              break;
            case 'int':
              properties += `    ${field}\n`;
              if (field === 'targetItemID') {
                propertiesDecoder += `            this.${field}.value = decoder.decodeIfPresent("uid") ?? this.${field}.value\n`;
              } else if (field !== 'sourceItemID') {
                propertiesDecoder += `            this.${field}.value = decoder.decodeIfPresent("${field}") ?? this.${field}.value\n`;
              }
              break;
            case 'float':
              properties += `    ${field}\n`;
              propertiesDecoder += `            this.${field}.value = decoder.decodeIfPresent("${field}") ?? this.${field}.value\n`;
              break;
            case 'any':
              if (entity === 'Item') continue;
              relations += `    get ${field}() {\n` +
                `        return this.edges("${field}")?.itemsArray()\n` +
                `    }\n\n`;
              break;
            default: // Relations are defined here, as they are not one of the primitive types (see cases above)
              if (entity === 'Item') continue;
              let sequenced, singular;
              if (Object.keys(entityHierarchy[entity]['relations']).includes(field)) {
                if (entityHierarchy[entity]['relations'][field]['sequenced']) sequenced = entityHierarchy[entity]['relations'][field]['sequenced'];
                if (entityHierarchy[entity]['relations'][field]['singular']) singular = entityHierarchy[entity]['relations'][field]['singular'];
              }
              relations += `    get ${field}() {\n` + //TODO Ani sorted
                `        return this.edge${singular ? '' : 's'}("${field}")?${sequenced ? '.sorted(byKeyPath: "sequence")' : ''}.${singular ? 'target' : 'items'}(${type})\n` +
                '    }\n\n';
          }
        }
      }
    }

    let decoderFunction;
    if (entity === 'Item') {
      decoderFunction = `    superDecode(decoder: Decoder) {
        decodeEdges(decoder, "allEdges", this)`;
    } else {
      decoderFunction = `    constructor(decoder) {
        super()

        jsonErrorHandling(function () {`;
    }

    // Additional functionality, and the right closing braces for the item.
    let additionalFunctionality;
    if (entity === 'Item') {
      additionalFunctionality = `    }

    /*enum CodingKeys {
        ${helpers.wrapText(codingKeys.join(', '), 92, '\n            ')}\n        }*/`;
    } else if (entity === 'Edge') {
      additionalFunctionality = '\n            this.parseTargetDict(decoder.decodeIfPresent("target"))\n        }.bind(this))';
    } else if (entity === 'SyncState') {
      additionalFunctionality = '        }.bind(this))';
    } else {
      additionalFunctionality = '\n            this.superDecode(decoder)\n        }.bind(this))';
    }

    let dataItemClass = `${classDescription}
${classDefinition}
${properties}${properties ? '\n' : ''}${relations}${decoderFunction}
${propertiesDecoder}${relationsDecoder}${additionalFunctionality}
    }
}
`;
    dataItemClasses.push(dataItemClass);
  }
  return dataItemClasses;
}

function getDataItemListToArray() {
  let dataItems = [];
  for (const [index, entity] of Object.keys(entityHierarchy).entries()) {
    if (['Datasource', 'SyncState', 'UserState', 'ViewArguments'].includes(entity)) continue;
    if (entity === 'Edge') {
      dataItems.push(`else if (object[0] instanceof Edge) { return object.itemsArray() }`);
    } else {
      dataItems.push(`${index === 0 ? '' : 'else '}if (object[0] instanceof ${entity}) { object.forEach(function (item) {collection.push(item)}) }`);
    }
  }
  return dataItems;
}

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');

  const [itemFamily, bgColors, fgColors, typeFunctions] = getItemFamily();
  const dataItemClasses = getDataItemClasses();
  const dataItemListToArray = getDataItemListToArray();
  const output = `//
//  WARNING: THIS FILE IS AUTOGENERATED; DO NOT CHANGE.
//  Visit https://gitlab.memri.io/memri/schema to learn more.
//
//  schema.ts
//
//  Copyright © 2020 memri. All rights reserved.
//

import {decodeEdges, jsonErrorHandling} from "../gui/util";
import {Color} from "../parsers/cvu-parser/CVUParser";

// The family of all data item classes
enum ItemFamily {
    ${helpers.insertList(itemFamily, 4)}
}

export var discriminator = Discriminator._type

export var backgroundColor = function(name) {
    switch (name) {
        ${helpers.insertList(bgColors, 8)}
    }
}

export var foregroundColor = function(name) {
    switch (name) {
        ${helpers.insertList(fgColors, 8)}
    }
}

export var getPrimaryKey = function(name) {
    return new getItemType(name)().primaryKey() ?? ""
}

export var getItemType = function(name) {
    switch (name) {
        ${helpers.insertList(typeFunctions, 8)}
    }
}

${helpers.insertList(dataItemClasses)}
export function dataItemListToArray(object) {
    var collection = []
    if (!Array.isArray(object) || !object.length) return
    ${helpers.insertList(dataItemListToArray, 4)}

    return collection
}
`;

  fs.writeFile(outputFile, output, (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();