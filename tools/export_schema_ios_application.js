const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../entityHierarchy/thing/Item');
const predicateHierarchyPath = path.resolve('../predicateHierarchy/predicate');
const outputFile = './schema.swift';

function getItemFamily() {
  let itemFamily = [], bgColors = [], fgColors = [], typeFunctions = [];
  for (const entity of Object.keys(entityHierarchy)) {
    if (entity === 'Item') continue;
    itemFamily.push(`case type${entity} = "${entity}"`);
    bgColors.push(`case .type${entity}: return Color(hex: "${entityHierarchy[entity]['backgroundColor']}")`);
    fgColors.push(`case .type${entity}: return Color(hex: "${entityHierarchy[entity]['foregroundColor']}")`);
    typeFunctions.push(`case .type${entity}: return ${entity}.self`);
  }
  return [itemFamily, bgColors, fgColors, typeFunctions];
}

function getDataItemClasses() {
  let dataItemClasses = [];
  const propertiesAndRelationsItem = Object.keys(entityHierarchy['Item']['properties']).concat(Object.keys(entityHierarchy['Item']['relations']))
  for (const entity of Object.keys(entityHierarchy)) {
    if (['Datasource', 'UserState', 'ViewArguments'].includes(entity)) continue;

    let classDescription = `\n/// ${entityHierarchy[entity]['description']}\n`;
    classDescription = helpers.wrapText(`/// ${entityHierarchy[entity]['description']}`, 100, '\n/// ');

    let classDefinition;
    switch (entity) {
      case 'Item':
        classDefinition = `public class SchemaItem: Object, Codable, Identifiable {`;
        break;
      case 'Session':
        classDefinition = `public class SchemaSession : Item {`;
        break;
      case 'Sessions':
        classDefinition = `public class SchemaSessions : Item {`;
        break;
      case 'Person':
        classDefinition = `public class SchemaPerson : Item {`;
        break;
      case 'SyncState':
        classDefinition = 'public class SyncState: Object, Codable {\n    let updatedFields = List<String>()';
        break;
      case 'Edge':
        classDefinition = `public class Edge : Object, Codable {`;
        break;
      default:
        classDefinition = `public class ${entity} : Item {`;
    }

    let properties = "";
    let propertiesDecoder = "";
    let relations = "";
    let relationsDecoder = "";
    let codingKeys = [];
    let propertiesAndRelations = Object.keys(entityHierarchy[entity]['properties']).concat(Object.keys(entityHierarchy[entity]['relations']))

    for (let field of propertiesAndRelations) {
      if (['genericType', 'functions', 'updatedFields'].includes(field)) continue;
      if (propertiesAndRelationsItem.includes(field) && !['Item', 'Edge'].includes(entity)) continue;

      if (Object.keys(predicateHierarchy).includes(field)) {
        if (!['changelog', 'label'].includes(field)) codingKeys.push(field);

        let type = predicateHierarchy[field]['expectedTypes'];
        if (field === 'syncState' || helpers.PRIMITIVE_TYPES.includes(type) || type === 'Edge') {
          properties += helpers.wrapText(`    /// ${predicateHierarchy[field]['description']}\n`, 96);
        } else if (!['changelog', 'label'].includes(field)) {
          relations += helpers.wrapText(`    /// ${predicateHierarchy[field]['description']}\n`, 96);
        }

        if (['allEdges', 'currentViewIndex', 'currentSessionIndex', 'version', 'views', 'sessions', 'syncState'].includes(field)) {
          switch (field) {
            case 'allEdges':
              properties += '    let allEdges = List<Edge>()\n';
              relationsDecoder += '            decodeEdges(decoder, "allEdges", self as! Item)\n';
              break;
            case 'currentViewIndex':
            case 'currentSessionIndex':
              properties += `    @objc dynamic var ${field}:Int = 0\n`;
              propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("${field}") ?? ${field}\n`;
              break;
            case 'version':
              properties += `    @objc dynamic var ${field}:Int = 1\n`;
              propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("${field}") ?? ${field}\n`;
              break;
            case 'views':
              relations += `    var ${field}: Results<${type}>? {\n` +
                `        edges("view")?.sorted(byKeyPath: "sequence").items(type:${type}.self)\n` +
                '    }\n\n';
              break;
            case 'sessions':
              relations += `    var ${field}: Results<${type}>? {\n` +
                `        edges("session")?.sorted(byKeyPath: "sequence").items(type:${type}.self)\n` +
                '    }\n\n';
              break;
            case 'syncState':
              properties += `    @objc dynamic var ${field}:${type}? = ${type}()\n`;
              propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("${field}") ?? ${field}\n`;
              break;
          }
        } else {
          switch (type) {
            case 'string':
              properties += `    @objc dynamic var ${field}:String? = nil\n`;
              if (field === 'targetItemType') {
                propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("itemType") ?? ${field}\n`;
              } else if (field !== 'sourceItemType') {
                propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("${field}") ?? ${field}\n`;
              }
              break;
            case 'datetime':
              properties += `    @objc dynamic var ${field}:Date? = nil\n`;
              propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("${field}") ?? ${field}\n`;
              break;
            case 'bool':
              properties += `    @objc dynamic var ${field}:Bool = false\n`;
              propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("${field}") ?? ${field}\n`;
              break;
            case 'int':
              properties += `    let ${field} = RealmOptional<Int>()\n`;
              if (field === 'targetItemID') {
                propertiesDecoder += `            ${field}.value = try decoder.decodeIfPresent("uid") ?? ${field}.value\n`;
              } else if (field !== 'sourceItemID') {
                propertiesDecoder += `            ${field}.value = try decoder.decodeIfPresent("${field}") ?? ${field}.value\n`;
              }
              break;
            case 'float':
              properties += `    let ${field} = RealmOptional<Double>()\n`;
              propertiesDecoder += `            ${field}.value = try decoder.decodeIfPresent("${field}") ?? ${field}.value\n`;
              break;
            case 'any':
              if (entity === 'Item') continue;
              relations += `    var ${field}: [Item]? {\n` +
                `        edges("${field}")?.itemsArray()\n` +
                `    }\n\n`;
              break;
            default: // Relations are defined here, as they are not one of the primitive types (see cases above)
              if (entity === 'Item') continue;
              let sequenced, singular;
              if (Object.keys(entityHierarchy[entity]['relations']).includes(field)) {
                if (entityHierarchy[entity]['relations'][field]['sequenced']) sequenced = entityHierarchy[entity]['relations'][field]['sequenced']
                if (entityHierarchy[entity]['relations'][field]['singular']) singular = entityHierarchy[entity]['relations'][field]['singular']
              }
              relations += `    var ${field}: ${singular ? `${type}` : `Results<${type}>`}? {\n` +
                `        edge${singular ? '' : 's'}("${field}")?${sequenced ? '.sorted(byKeyPath: "sequence")' : ''}.${singular ? 'target' : 'items'}(type:${type}.self)\n` +
                '    }\n\n';
          }
        }
      }
    }

    let decoderFunction;
    if (entity === 'Item') {
      decoderFunction = '    public func superDecode(from decoder: Decoder) throws {';
    } else {
      decoderFunction = `    public required convenience init(from decoder: Decoder) throws {
        self.init()

        jsonErrorHandling(decoder) {`;
    }

    // Additional functionality, and the right closing braces for the item.
    let additionalFunctionality;
    if (entity === 'Item') {
      additionalFunctionality = `    }
      
    private enum CodingKeys: String, CodingKey {
        ${helpers.wrapText('case ' + codingKeys.join(', '), 92, '\n            ')}`;
    } else if (entity === 'Edge') {
      additionalFunctionality = '\n            try parseTargetDict(try decoder.decodeIfPresent("target"))\n        }';
    } else if (entity === 'SyncState') {
      additionalFunctionality = '        }';
    } else {
      additionalFunctionality = '\n            try self.superDecode(from: decoder)\n        }';
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
      dataItems.push(`else if let list = object as? Results<Edge> { return list.itemsArray() }`);
    } else {
      dataItems.push(`${index === 0 ? '' : 'else '}if let list = object as? Results<${entity}> { list.forEach { collection.append($0) } }`);
    }
  }
  return dataItems;
}

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy2(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'predicate');

  const [itemFamily, bgColors, fgColors, typeFunctions] = getItemFamily();
  const dataItemClasses = getDataItemClasses();
  const dataItemListToArray = getDataItemListToArray();
  const output = `//
//  WARNING: THIS FILE IS AUTOGENERATED; DO NOT CHANGE.
//  Visit https://gitlab.memri.io/memri/schema to learn more.
//
//  schema.swift
//
//  Copyright © 2020 memri. All rights reserved.
//

import Foundation
import Combine
import SwiftUI
import RealmSwift

public typealias List = RealmSwift.List

// The family of all data item classes
enum ItemFamily: String, ClassFamily, CaseIterable {
    ${helpers.insertList(itemFamily, 4)}

    static var discriminator: Discriminator = ._type

    var backgroundColor: Color {
        switch self {
        ${helpers.insertList(bgColors, 8)}
        }
    }

    var foregroundColor: Color {
        switch self {
        ${helpers.insertList(fgColors, 8)}
        }
    }

    func getPrimaryKey() -> String {
        return self.getType().primaryKey() ?? ""
    }

    func getType() -> AnyObject.Type {
        switch self {
        ${helpers.insertList(typeFunctions, 8)}
        }
    }
}

${helpers.insertList(dataItemClasses)}
func dataItemListToArray(_ object: Any) -> [Item] {
    var collection: [Item] = []

    ${helpers.insertList(dataItemListToArray, 4)}

    return collection
}
`;

  fs.writeFile(outputFile, output, (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();