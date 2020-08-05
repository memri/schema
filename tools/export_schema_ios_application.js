const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../TypeHierarchy/Item');
const predicateHierarchyPath = path.resolve('../EdgeAndPropertyHierarchy');
const outputFile = './schema.swift';

function getItemFamily() {
  let itemFamily = [], bgColors = [], fgColors = [], typeFunctions = [];
  for (const entity of Object.keys(entityHierarchy).sort()) {
    if (entity === 'Item') continue;
    itemFamily.push(`case type${entity} = "${entity}"`);
    bgColors.push(`case .type${entity}: return Color(hex: "${entityHierarchy[entity]['backgroundColor']}")`);
    fgColors.push(`case .type${entity}: return Color(hex: "${entityHierarchy[entity]['foregroundColor']}")`);
    typeFunctions.push(`case .type${entity}: return ${entity}.self`);
  }
  return [itemFamily, bgColors, fgColors, typeFunctions];
}

function getDataItemClasses() {
  let propertiesAndRelationsItem = entityHierarchy['Item']['properties'].concat(Object.keys(entityHierarchy['Item']['relations']));
  let dataItemClasses = [];
  for (const entity of Object.keys(entityHierarchy).sort()) {
    if (['Datasource', 'UserState', 'ViewArguments', 'CVUStateDefinition'].includes(entity)) continue;

    let classDescription = `\n/// ${entityHierarchy[entity]['description']}\n`;
    classDescription = helpers.wrapText(`/// ${entityHierarchy[entity]['description']}`, 100, '\n/// ');

    let classDefinition;
    switch (entity) {
      case 'Item':
        classDefinition = `public class SchemaItem: SyncableItem, Codable, Identifiable {`;
        break;
      case 'Person':
        classDefinition = `public class SchemaPerson : Item {`;
        break;
      case 'Edge':
        classDefinition = `public class Edge : SyncableItem, Codable {`;
        break;
      default:
        classDefinition = `public class ${entity} : Item {`;
    }

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
    let propertiesDecoder = "";
    let relations = "";
    let relationsDecoder = "";
    let codingKeys = [];
    for (const field of propertiesAndRelations) {
      if (['genericType', 'functions', 'updatedFields'].includes(field)) continue;
      if (propertiesAndRelationsItem.includes(field) && !['Item', 'Edge'].includes(entity)) continue;

      if (Object.keys(predicateHierarchy).includes(field)) {
        let type = predicateHierarchy[field]['type'];
        if (entity === 'Item' && !helpers.PRIMITIVE_TYPES.includes(type) && field !== 'allEdges') {
          continue
        }

        if (!['changelog', 'label'].includes(field)) codingKeys.push(field);

        if (field === 'syncState' || helpers.PRIMITIVE_TYPES.includes(type) || type === 'Edge') {
          properties += helpers.wrapText(`    /// ${predicateHierarchy[field]['description']}\n`, 96);
        } else if (!['changelog', 'label'].includes(field)) {
          relations += helpers.wrapText(`    /// ${predicateHierarchy[field]['description']}\n`, 96);
        }

        if (['allEdges', 'currentViewIndex', 'currentSessionIndex', 'version'].includes(field)) {
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
          }
        } else {
          switch (type) {
            case 'string':
              properties += `    @objc dynamic var ${field}:String? = nil\n`;
              if (field === 'targetItemType') {
                propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("targetType") ?? ${field}\n`;
              } else if (field === 'type') {
                propertiesDecoder += `            ${field} = try decoder.decodeIfPresent("_type") ?? ${field}\n`;
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
              for (const _item in ancestry) {
                if (Object.keys(entityHierarchy[_item]['relations']).includes(field)) {
                  if (entityHierarchy[_item]['relations'][field]['sequenced']) sequenced = entityHierarchy[_item]['relations'][field]['sequenced'];
                  if (entityHierarchy[_item]['relations'][field]['singular']) singular = entityHierarchy[_item]['relations'][field]['singular'];
                  break
                }
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
      additionalFunctionality = '\n            try parseTargetDict(try decoder.decodeIfPresent("_target"))\n        }';
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
  for (const [index, entity] of Object.keys(entityHierarchy).sort().entries()) {
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
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'EdgeOrProperty');

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

public class SyncableItem: Object {
    let _updated = List<String>()
    /// TBD
    @objc dynamic var _partial:Bool = false
    /// TBD
    @objc dynamic var _action:String? = nil
    /// TBD
    @objc dynamic var _changedInSession:Bool = false
}

public class CVUStateDefinition : CVUStoredDefinition {
    required init () {
        super.init()
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