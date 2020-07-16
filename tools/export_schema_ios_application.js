const fs = require('fs');
const helpers = require('./helpers');
const path = require('path');

const entityHierarchyPath = path.resolve('../entityHierarchy/thing/Item');
const predicateHierarchyPath = path.resolve('../predicateHierarchy/predicate');
const outputFile = './schema.swift';

function getHeader() {
  return `//
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

`;
}

function getItemFamily() {
  // The Item family.
  let output = '// The family of all data item classes\n' +
    'enum ItemFamily: String, ClassFamily, CaseIterable {\n';
  for (const entity of Object.keys(entityHierarchy)) {
    if (['Item'].includes(entity)) continue; // TODO global
    output += `    case type${entity} = "${entity}"\n`;
  }
  output += '\n    static var discriminator: Discriminator = ._type\n\n';

  // Background colors.
  output += '    var backgroundColor: Color {\n' +
    '        switch self {\n';
  for (const entity of Object.keys(entityHierarchy)) {
    if (['Item'].includes(entity)) continue; // TODO global
    output += `        case .type${entity}: return Color(hex: "${entityHierarchy[entity]['backgroundColor']}")\n`; // TODO
  }
  output += '        }\n' +
    '    }\n\n';

  // Foreground colors.
  output += '    var foregroundColor: Color {\n' +
    '        switch self {\n';
  for (const entity of Object.keys(entityHierarchy)) {
    if (['Item'].includes(entity)) continue; // TODO global
    output += `        case .type${entity}: return Color(hex: "${entityHierarchy[entity]['foregroundColor']}")\n`; // TODO
  }
  output += '        }\n' +
    '    }\n\n';

  // Get primary key functions.
  output += '    func getPrimaryKey() -> String {\n' +
    '        return self.getType().primaryKey() ?? \"\"\n' +
    '    }\n\n';

  // Get type functions.
  output += '    func getType() -> AnyObject.Type {\n' +
    '        switch self {\n';
  for (const entity of Object.keys(entityHierarchy)) {
    if (['Item'].includes(entity)) continue; // TODO global
    output += `        case .type${entity}: return ${entity}.self\n`;
  }
  output += '        }\n' +
    '    }\n' +
    '}\n';
  return output;
}

function getDataItemClasses() {
  let output = '';
  for (const entity of Object.keys(entityHierarchy)) {
    if (['Datasource', 'UserState', 'ViewArguments'].includes(entity)) continue; // Datasource and UserState are defined elsewhere.
    let description = `\n/// ${entityHierarchy[entity]['description']}\n`;
    output += helpers.wrapText(description, 100, '\n/// ');

    // A set of Items needs to be prepended with 'Schema' for front end functionality
    switch (entity) {
      case 'Item':
        output += `public class SchemaItem: Object, Codable, Identifiable {\n`;
        break;
      case 'Session':
        output += `public class SchemaSession : Item {\n`;
        break;
      case 'Sessions':
        output += `public class SchemaSessions : Item {\n`;
        break;
      case 'Person':
        output += `public class SchemaPerson : Item {\n`;
        break;
      case 'SyncState':
        output += `public class SyncState: Object, Codable {\n`;
        break;
      case 'Edge':
        output += `public class Edge : Object, Codable {\n`;
        break;
      case 'Datasource':
      case 'UserState':
        continue;
      default:
        output += `public class ${entity} : Item {\n`;
    }

    // Properties.
    let dynamicVars = "";
    let dynamicVarsDecoder = "";

    let realmOptionals = "";
    let realmOptionalsDecoder = "";

    let relations = "";
    let relationsDecoder = "";

    let codingKeys = [];

    for (let property of entityHierarchy[entity]['properties']) {
      // Skip properties already defined in 'Item', as in swift the only inheritance is that every Item extends 'Item'.
      if (entityHierarchy['Item']['properties'].includes(property) && !['Item', 'Edge'].includes(entity) || ['genericType', 'functions'].includes(property)) {
        continue;
      } else if (entity === 'Edge') {
        // console.log(entity, property) // TODO remove scaffolding
      }
      if (Object.keys(predicateHierarchy).includes(property)) {
        if (!['changelog', 'label'].includes(property)) codingKeys.push(property);
        let type = predicateHierarchy[property]['expectedTypes'];
        if (property === 'allEdges') {
          output += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
          output += '    let allEdges = List<Edge>()\n';
          relationsDecoder += '            decodeEdges(decoder, "allEdges", self as! Item)\n';
        } else if (property === 'updatedFields') {
          output += '    let updatedFields = List<String>()\n';
        } else if (['currentViewIndex', 'currentSessionIndex'].includes(property)) {
          dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
          dynamicVars += `    @objc dynamic var ${property}:Int = 0\n`;
          dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
        } else if ('version' === property) {
          dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
          dynamicVars += `    @objc dynamic var ${property}:Int = 1\n`;
          dynamicVarsDecoder += `            ${property} = try decoder.decodeIfPresent("${property}") ?? ${property}\n`;
        } else if (type === 'string') {
          dynamicVars += helpers.wrapText('    /// ' + predicateHierarchy[property]['description'] + '\n', 96);
          dynamicVars += `    @objc dynamic var ${property}:String? = nil\n`;
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
      } else {
        console.log(`Error while processing, item "${entity}" has non existent field "${property}"`);
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
      output += '\n            try parseTargetDict(try decoder.decodeIfPresent("target"))\n'
      output += '        }\n';
    } else if (entity === 'SyncState') {
      output += '        }\n';
    } else {
      output += '\n            try self.superDecode(from: decoder)\n';
      output += '        }\n';
    }
    output += '    }\n' +
      '}\n';
  }
  return output;
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

  let output = getHeader();
  output += getItemFamily();
  output += getDataItemClasses();
  output += getDataItemListToArray();

  fs.writeFile(outputFile, output, (err) => {
    if (err) throw err;
    console.log('File saved as ' + outputFile);
  });
})();