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
  return [itemFamily, bgColors, fgColors, typeFunctions]
}

function getDataItemClasses() {
  let dataItemClasses = [];
  for (const entity of Object.keys(entityHierarchy)) {
    let output = '';
    if (['Datasource', 'UserState', 'ViewArguments'].includes(entity)) continue;

    let classDescription = `\n/// ${entityHierarchy[entity]['description']}\n`;
    output += helpers.wrapText(classDescription, 100, '\n/// ');
    classDescription = helpers.wrapText(`/// ${entityHierarchy[entity]['description']}`, 100, '\n/// ');

    let classDefinition;
    switch (entity) {
      case 'Item':
        output += `public class SchemaItem: Object, Codable, Identifiable {\n`;
        classDefinition = `public class SchemaItem: Object, Codable, Identifiable {`;
        break;
      case 'Session':
        output += `public class SchemaSession : Item {\n`;
        classDefinition = `public class SchemaSession : Item {`;
        break;
      case 'Sessions':
        output += `public class SchemaSessions : Item {\n`;
        classDefinition = `public class SchemaSessions : Item {`;
        break;
      case 'Person':
        output += `public class SchemaPerson : Item {\n`;
        classDefinition = `public class SchemaPerson : Item {`;
        break;
      case 'SyncState':
        output += 'public class SyncState: Object, Codable {\n    let updatedFields = List<String>()\n';
        classDefinition = 'public class SyncState: Object, Codable {\n    let updatedFields = List<String>()';
        break;
      case 'Edge':
        output += `public class Edge : Object, Codable {\n`;
        classDefinition = `public class Edge : Object, Codable {`;
        break;
      default:
        output += `public class ${entity} : Item {\n`;
        classDefinition = `public class ${entity} : Item {`;
    }

    // Properties.
    let properties = "";
    let propertiesDecoder = "";
    let relations = "";
    let relationsDecoder = "";
    let codingKeys = [];

    let propertiesList = [], relationsList = [];

    for (let property of entityHierarchy[entity]['properties']) {
      if (['genericType', 'functions', 'updatedFields'].includes(property)) continue;
      if (entityHierarchy['Item']['properties'].includes(property) && !['Item', 'Edge'].includes(entity)) continue;

      let sequenced;
      if (property.substring(0, 10) === 'sequenced_') {
        property = property.substring(10);
        sequenced = true;
      }

      let singular;
      if (property.substring(0, 4) === 'one_') {
        property = property.substring(4);
        singular = true;
      }

      if (Object.keys(predicateHierarchy).includes(property)) {
        if (!['changelog', 'label'].includes(property)) codingKeys.push(property);

        // Add description of property/relation.
        let type = predicateHierarchy[property]['expectedTypes'];
        if (property === 'syncState' || helpers.PRIMITIVE_TYPES.includes(type) || type === 'Edge') {
          properties += helpers.wrapText(`    /// ${predicateHierarchy[property]['description']}\n`, 96);
        } else if (!['changelog', 'label'].includes(property)) {
          relations += helpers.wrapText(`    /// ${predicateHierarchy[property]['description']}\n`, 96);
        }

        // Special cases.
        if (['allEdges', 'currentViewIndex', 'currentSessionIndex', 'version', 'views', 'sessions', 'syncState'].includes(property)) {
          switch (property) {
            case 'allEdges':
              properties += '    let allEdges = List<Edge>()\n';
              relationsDecoder += '            decodeEdges(decoder, "allEdges", self as! Item)\n';
              break;
            case 'currentViewIndex':
            case 'currentSessionIndex':
              properties += `    @objc dynamic var ${property}:Int = 0\n`;
              propertiesDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
              break;
            case 'version':
              properties += `    @objc dynamic var ${property}:Int = 1\n`;
              propertiesDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
              break;
            case 'views':
              relations += `    var ${property}: Results<${type}>? {\n` +
                `        edges("view")?.sorted(byKeyPath: "sequence").items(type:${type}.self)\n` +
                '    }\n\n';
              break;
            case 'sessions':
              relations += `    var ${property}: Results<${type}>? {\n` +
                `        edges("session")?.sorted(byKeyPath: "sequence").items(type:${type}.self)\n` +
                '    }\n\n';
              break;
            case 'syncState':
              properties += `    @objc dynamic var ${property}:${type}? = ${type}()\n`;
              propertiesDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
              break;
          }
        } else {
          switch (type) {
            case 'string':
              properties += `    @objc dynamic var ${property}:String? = nil\n`;
              if (property === 'targetItemType') {
                propertiesDecoder += `            ${property} = try decoder.decodeIfPresent("itemType") ?? ${property}\n`;
              } else if (property !== 'sourceItemType') {
                propertiesDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
              }
              break;
            case 'datetime':
              properties += `    @objc dynamic var ${property}:Date? = nil\n`;
              propertiesDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
              break;
            case 'bool':
              properties += `    @objc dynamic var ${property}:Bool = false\n`;
              propertiesDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
              break;
            case 'int':
              properties += `    let ${property} = RealmOptional<Int>()\n`;
              if (property === 'targetItemID') {
                propertiesDecoder += `            ${property}.value = try decoder.decodeIfPresent("uid") ?? ${property}.value\n`;
              } else if (property !== 'sourceItemID') {
                propertiesDecoder += `            ${property}.value = try decoder.decodeIfPresent("${property}") ?? ${property}.value\n`;
              }
              break;
            case 'float':
              properties += `    let ${property} = RealmOptional<Double>()\n`;
              propertiesDecoder += `            ${property}.value = try decoder.decodeIfPresent("${property}") ?? ${property}.value\n`;
              break;
            case 'any':
              if (entity === 'Item') continue;
              relations += `    var ${property}: [Item]? {\n` +
                `        edges("${property}")?.itemsArray()\n` +
                `    }\n\n`;
              break;
            default:
              if (entity === 'Item') continue;
              relations += `    var ${property}: ${singular ? `${type}` : `Results<${type}>`}? {\n` +
                `        edge${singular ? '' : 's'}("${property}")?${sequenced ? '.sorted(byKeyPath: "sequence")' : ''}.${singular ? 'target' : 'items'}(type:${type}.self)\n` +
                '    }\n\n';
          }
        }
      }
    }
    output += properties;
    if (properties) output += '\n';
    output += relations;

    // Decoder
    if (entity === 'Item') {
      output += '    public func superDecode(from decoder: Decoder) throws {\n';
    } else {
      output += `    public required convenience init(from decoder: Decoder) throws {
        self.init()
        
        jsonErrorHandling(decoder) {
`;
    }
    output += relationsDecoder;
    output += propertiesDecoder;


    if (entity === 'Item') {
      output += '    }\n\n' +
        '    private enum CodingKeys: String, CodingKey {\n' +
        '        ' + helpers.wrapText('case ' + codingKeys.join(', ') + '\n', 92, '\n            ');
    } else if (entity === 'Edge') {
      output += '\n            try parseTargetDict(try decoder.decodeIfPresent("target"))\n';
      output += '        }\n';
    } else if (entity === 'SyncState') {
      output += '        }\n';
    } else {
      output += '\n            try self.superDecode(from: decoder)\n';
      output += '        }\n';
    }
    output += '    }\n' +
      '}';
    dataItemClasses.push(output);


    let test = `
${classDescription}
${classDefinition}
    ${properties}
    ${relations}
    public required convenience init(from decoder: Decoder) throws {
        self.init()

        jsonErrorHandling(decoder) {
            definition = try decoder.decodeIfPresent("definition") ?? definition
            domain = try decoder.decodeIfPresent("domain") ?? domain
            name = try decoder.decodeIfPresent("name") ?? name
            query = try decoder.decodeIfPresent("query") ?? query
            selector = try decoder.decodeIfPresent("selector") ?? selector
            type = try decoder.decodeIfPresent("type") ?? type

            try self.superDecode(from: decoder)
        }
    }
}
`;
    // console.log(test);
  }

  return helpers.insertList(dataItemClasses);
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
  return dataItems
}

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'predicate');

  const [itemFamily, bgColors, fgColors, typeFunctions] = getItemFamily()
  const dataItemClasses = getDataItemClasses()
  const dataItemListToArray = getDataItemListToArray()
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
${dataItemClasses}

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