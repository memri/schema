## About
Schema is an open-source component of [Memri](https://blog.memri.io). It functions as the single source of truth of the
data model of your personal data. The latest stable version can be explored at 
[schema.memri.io](https://schema.memri.io).  

This repository contains code to export schema definitions for both the 
[Pod](https://gitlab.memri.io/memri/pod) and the [iOS app](https://gitlab.memri.io/memri/ios-application). This is only
necessary if you [change the schema](#Changing the schema), as they both repositories already include a generated 
schema.

## Local build/install
To run the code, make sure you have [Node.js and npm](https://www.npmjs.com/get-npm) installed and run:
```bash
cd tools/
npm install
```

To run the explorer (web app): `node explorer.js`  
To test whether the schema contains inconsistencies: `node test.js`  
To export the schema for the Pod: `node export_schema_pod.js`  
To export the schema for the iOS application: `node export_schema_ios_application.js`  
To export the schema for the Web application: `node export_schema_web_application.js`  
To export the schema for the Indexers: `node export_schema_indexers.js`  

## The schema
The schema consists of 2 parts:
* Type Hierarchy
* Edge & Property Hierarchy

### Item Hierarchy
All the data points in Memri are called items, e.g. a Person, a Location or a Video. The top level item is called Item, 
and all other items inherit all the properties and edges of Item.

The Item hierarchy defines:
* What types of Items exist
* What properties and edges an Item can have
* How Items are positioned in the hierarchy

### Edge & Property Hierarchy
Items can have Edges and Properties, which are in the same hierarchy.

The Edge & Property hierarchy defines:
* What types of Edges and Properties exist
* What types Edges and Properties expect
* How Edges and Properties are positioned in the hierarchy

#### Edges
Edges are connections to other items, for instance, there might be an 'attends' edge from a Person to an Event. By 
default, edges are one-to-many relations: An item can have any number of edges of an allowed edge type.

#### Properties
Where edges connect to other items, properties connect directly to a value of a primitive type, for instance, an item 
could have a 'name' property of type 'String'. Properties are always one-to-one relations: An item can only have single 
value for a property.

### Primitive types
The primitive types that are supported by the data model are defined in `TypeHierarchy/primitive`. All properties must 
expect one of these types. 

## Changing the schema
The schema is stored as two directory trees for the two hierarchies, with a set of files to define their
characteristics. 

The information of an Item is stored as follows:
* The directory location defines its position in the hierarchy
* The directory name, and the name of the json file it contains, is the name of the item
* The json file specifies the actual item:
```json
{
  "description": "A short description of the item.",
  "properties": [
    "someProperty"
  ],
  "relations": {
    "someEdge": {
      "sequenced": false,
      "singular": false
    }
  },
  "foregroundColor": "#ffffff",
  "backgroundColor": "#3a5eb2"
}
```
The information of an edge or property is stored as follows:
* The directory location defines its position in the hierarchy
* The directory name, and the name of the json file it contains, is the name of the edge or property
* The json file specifies the actual edge or property:
```json
{
  "description": "A short description of the edge or property.",
  "type": "ExpectedItemTypeOrPrimitive"
}
```

If you added an Item, Edge or Property, make sure to run `node test.js` to see whether there are inconsistencies.
 
If there aren't, use the `node export_schema_X.js` scripts to create the schemas for the projects you are working on,
 and overwrite them in the corresponding projects and rebuild those. We plan to automate this process further in the
 near future to improve the developer experience.