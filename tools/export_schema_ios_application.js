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
  return `// The family of all data item classes
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
}`;
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
        output += `public class SyncState: Object, Codable {\n`;
        classDefinition = `public class SyncState: Object, Codable {`;
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
    let dynamicVars = "";
    let dynamicVarsDecoder = "";
    let realmOptionals = "";
    let realmOptionalsDecoder = "";
    let relations = "";
    let relationsDecoder = "";
    let codingKeys = [];

    let propertiesList = [], relationsList = [];

    for (let property of entityHierarchy[entity]['properties']) {
      if (['genericType', 'functions'].includes(property)) continue;
      if (entityHierarchy['Item']['properties'].includes(property) && !['Item', 'Edge'].includes(entity)) continue;

      if (Object.keys(predicateHierarchy).includes(property)) {
        if (!['changelog', 'label'].includes(property)) codingKeys.push(property);
        let type = predicateHierarchy[property]['expectedTypes'];

        switch (property) {
          case 'allEdges':
            output += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            output += '    let allEdges = List<Edge>()\n';
            relationsDecoder += '            decodeEdges(decoder, "allEdges", self as! Item)\n';
            break;
          case 'updatedFields':
            output += '    let updatedFields = List<String>()\n';
            break;
          case 'currentViewIndex':
          case 'currentSessionIndex':
            dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            dynamicVars += `    @objc dynamic var ${property}:Int = 0\n`;
            dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
            break;
          case 'version':
            dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            dynamicVars += `    @objc dynamic var ${property}:Int = 1\n`;
            dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
            break;
        }
        
        if (!['allEdges', 'updatedFields', 'currentViewIndex', 'currentSessionIndex', 'version'].includes(property)) {
          if (type === 'string') {
            dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            dynamicVars += `    @objc dynamic var ${property}:String? = nil\n`;

            propertiesList.push(helpers.wrapText(`/// ${predicateHierarchy[property]['description']}`, 96));
            propertiesList.push(helpers.wrapText(`@objc dynamic var ${property}:String? = nil`));
            if (property === 'targetItemType') {
              dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("itemType") ?? ${property}\n`;
            } else if (property !== 'sourceItemType') {
              dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
            }
          } else if (type === 'datetime') {
            dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            dynamicVars += `    @objc dynamic var ${property}:Date? = nil\n`;
            dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
          } else if (type === 'bool') {
            dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            dynamicVars += `    @objc dynamic var ${property}:Bool = false\n`;
            dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
          } else if (type === 'int') {
            realmOptionals += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            realmOptionals += `    let ${property} = RealmOptional<Int>()\n`;
            if (property === 'targetItemID') {
              realmOptionalsDecoder += `            ${property}.value = try decoder.decodeIfPresent("uid") ?? ${property}.value\n`;
            } else if (property !== 'sourceItemID') {
              realmOptionalsDecoder += `            ${property}.value = try decoder.decodeIfPresent("${property}") ?? ${property}.value\n`;
            }
          } else if (type === 'float') {
            realmOptionals += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            realmOptionals += `    let ${property} = RealmOptional<Double>()\n`;
            realmOptionalsDecoder += `            ${property}.value = try decoder.decodeIfPresent("${property}") ?? ${property}.value\n`;
          } else if (type === 'any') {
            if (entity === 'Item') continue;
            relations += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            relations += `    var ${property}: [Item]? {\n` +
              `        edges("${property}")?.itemsArray()\n` +
              `    }\n\n`;
          } else {
            if (entity === 'Item') continue;
            relations += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            relations += `    var ${property}: Results<${type}>? {\n` +
              `        edges("${property}")?.items(type:${type}.self)\n` +
              '    }\n\n';
          }
        }
      } else if (property.substring(0, 4) === 'one_') {
        property = property.substring(4);
        let type = predicateHierarchy[property]['expectedTypes'];
        codingKeys.push(property);
        if (['Item', 'Edge'].includes(entity)) {
          if (property === 'edgeLabel') {
            dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            dynamicVars += `    @objc dynamic var ${property}:String? = nil\n`;
            dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
          } else {
            dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
            dynamicVars += `    @objc dynamic var ${property}:${type}? = ${type}()\n`;
            dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
          }
        } else {
          relations += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
          relations += `    var ${property}: ${type}? {\n` +
            `        edge("${property}")?.target(type:${type}.self)\n` +
            '    }\n\n';
        }
      } else if (property.substring(0, 10) === 'sequenced_') {
        property = property.substring(10);
        let type = predicateHierarchy[property]['expectedTypes'];
        relations += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
        if (property === 'views') {
          relations += `    var ${property}: Results<${type}>? {\n` +
            `        edges("view")?.sorted(byKeyPath: "sequence").items(type:${type}.self)\n` +
            '    }\n\n';
        } else if (property === 'sessions') {
          relations += `    var ${property}: Results<${type}>? {\n` +
            `        edges("session")?.sorted(byKeyPath: "sequence").items(type:${type}.self)\n` +
            '    }\n\n';
        } else {
          relations += `    var ${property}: Results<${type}>? {\n` +
            `        edges("${property}")?.sorted(byKeyPath: "sequence").items(type:${type}.self)\n` +
            '    }\n\n';
        }
      }
    }
    output += dynamicVars;
    output += realmOptionals;
    if (dynamicVars || realmOptionals) output += '\n';
    output += relations;

    // Decoder
    if (entity === 'Item') {
      output += '    public func superDecode(from decoder: Decoder) throws {\n';
    } else {
      output += '    public required convenience init(from decoder: Decoder) throws {\n';
    }
    if (['Item'].includes(entity)) {
      // output += '        self.init()\n\n'; // TODO
    } else {
      output += '        self.init()\n';
    }
    if (entity !== 'Item') {
      output += '        \n' +
        '        jsonErrorHandling(decoder) {\n';
    }
    if (entityHierarchy[entity]['properties']) {
      output += relationsDecoder;
      output += dynamicVarsDecoder;
      output += realmOptionalsDecoder;
    }
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
    dataItemClasses.push(output)

    let test = `
${classDescription}
${classDefinition}
    ${helpers.insertList(propertiesList, 4)}
    ${helpers.insertList(relationsList, 4)}
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
  let output = '\nfunc dataItemListToArray(_ object: Any) -> [Item] {\n' +
    '    var collection: [Item] = []\n\n';
  for (const [index, entity] of Object.keys(entityHierarchy).entries()) {
    if (['Datasource', 'SyncState', 'UserState', 'ViewArguments'].includes(entity)) continue;
    if (index !== 0) {
      output += '    else ';
    } else {
      output += '    ';
    }
    if (entity === 'Edge') {
      output += 'if let list = object as? Results<Edge> { return list.itemsArray() }\n';
    } else {
      output += `if let list = object as? Results<${entity}> { list.forEach { collection.append($0) } }\n`;
    }
  }
  output += '\n    return collection\n' +
    '}\n';

  return output;
}

let entityHierarchy = {};
let predicateHierarchy = {};
(async () => {
  await helpers.getHierarchy(entityHierarchyPath, entityHierarchy, entityHierarchyPath, 'Item');
  await helpers.getHierarchy(predicateHierarchyPath, predicateHierarchy, predicateHierarchyPath, 'predicate');

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

${getItemFamily()}
${getDataItemClasses()}
${getDataItemListToArray()}`;

  fs.writeFile(outputFile, output, (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();
