//
//  schema.swift
//  memri
//
//  Created by Ruben Daniels on 4/1/20.
//  Copyright © 2020 memri. All rights reserved.
//

import Foundation
import Combine
import SwiftUI
import RealmSwift

public typealias List = RealmSwift.List

// The family of all data item classes
enum DataItemFamily: String, ClassFamily, CaseIterable {
    // TODO
    case type<<DATATYPE>> = "<<DATATYPE>>"

    static var discriminator: Discriminator = .type

    // TODO COLORS IN SCHEMA DEF??
    var backgroundColor: Color {
        switch self{
        case .typeNote: return Color(hex: "#93c47d")
        case .typeLabel: return Color(hex: "#93c47d")
        case .typePhoto: return Color(hex: "#93c47d")
        case .typeVideo: return Color(hex: "#93c47d")
        case .typeAudio: return Color(hex: "#93c47d")
        case .typeFile: return Color(hex: "#93c47d")
        case .typePerson: return Color(hex: "#3a5eb2")
        case .typeAuditItem: return Color(hex: "#93c47d")
        case .typeSessions: return Color(hex: "#93c47d")
        case .typePhoneNumber: return Color(hex: "#eccf23")
        case .typeWebsite: return Color(hex: "#3d57e2")
        case .typeLocation: return Color(hex: "#93c47d")
        case .typeAddress: return Color(hex: "#93c47d")
        case .typeCountry: return Color(hex: "#93c47d")
        case .typeCompany: return Color(hex: "#93c47d")
        case .typePublicKey: return Color(hex: "#93c47d")
        case .typeOnlineProfile: return Color(hex: "#93c47d")
        case .typeDiet: return Color(hex: "#37af1c")
        case .typeMedicalCondition: return Color(hex: "#3dc8e2")
        case .typeSession: return Color(hex: "#93c47d")
        case .typeSessionView: return Color(hex: "#93c47d")
        case .typeCVUStoredDefinition: return Color(hex: "#93c47d")
        case .typeImporter: return Color(hex: "#93c47d")
        case .typeIndexer: return Color(hex: "#93c47d")
        case .typeImporterInstance: return Color(hex: "#93c47d")
        case .typeIndexerInstance: return Color(hex: "#93c47d")
        }
    }
    
    var foregroundColor: Color {
        switch self{
        default:
            return Color(hex: "#fff")
        }
    }
    
    func getPrimaryKey() -> String {
        return self.getType().primaryKey() ?? ""
    }
    
    func getType() -> AnyObject.Type {
        switch self {
        // TODO
        case .type<<DATATYPE>>: return <<DATATYPE>>.self
        }
    }
}

// TODO
// TRIPLE SLASH XDOC?
class <<DATATYPE>>:DataItem {
    override var genericType:String { "<<DATATYPE>>" }


    // TODO
    // - when is there a override vs dynamic var?
    override var computedTitle:String {
        return number ?? ""
    }

    @objc dynamic var <<PROPERTY>>:<<PROPERTY_TYPE>>? = nil

    // TODO why 'let' instead of '@objc' here?
    let latitude = RealmOptional<Double>()
    let longitude = RealmOptional<Double>()


    @objc dynamic var flag:File? = nil // or Image ??


    required init () {
        super.init()
    }

    public required init(from decoder: Decoder) throws {
        super.init()

        jsonErrorHandling(decoder) {
            <<PROPERTY>> = try decoder.decodeIfPresent("<<PROPERTY>>") ?? <<PROPERTY>>
            //TODO when use .value?

            latitude.value = try decoder.decodeIfPresent("latitude") ?? latitude.value

            try self.superDecode(from: decoder)
            if let htmlContent = content, textContent == nil || textContent == "" {
                self.textContent = htmlContent.replacingOccurrences(of: "<[^>]+>", with: "",
                                                                    options: .regularExpression,
                                                                    range: nil)
            }
        }
    }
}

class AuditItem:DataItem {

    @objc dynamic var date:Date? = Date()
    @objc dynamic var contents:String? = nil
    @objc dynamic var action:String? = nil
    override var genericType:String { "AuditItem" }

    override var computedTitle:String {
        return "Logged \(action ?? "unknown action") on \(date?.description ?? "")"
    }

    let appliesTo = List<Edge>()

    required init () {
        super.init()
    }

    convenience init(date: Date? = nil,contents: String? = nil, action: String? = nil,
                     appliesTo: [DataItem]? = nil) {
        self.init()
        self.date = date ?? self.date
        self.contents = contents ?? self.contents
        self.action = action ?? self.action
                
        if let appliesTo = appliesTo{
            let edges = appliesTo.map{ Edge(self.memriID, $0.memriID, self.genericType, $0.genericType) }
            
            let edgeName = "appliesTo"
            
//            item["~appliesTo"] =  edges
            // TODO
            self.appliesTo.append(objectsIn: edges)
//            for item in appliesTo{
//                item.changelog.append(objectsIn: edges)
//            }
        }
    }
    
    public required init(from decoder: Decoder) throws {
        super.init()
        
        jsonErrorHandling(decoder) {
            date = try decoder.decodeIfPresent("date") ?? date
            contents = try decoder.decodeIfPresent("contents") ?? contents
            action = try decoder.decodeIfPresent("action") ?? action
            
            decodeEdges(decoder, "appliesTo", DataItem.self, self.appliesTo, self)
            
            try self.superDecode(from: decoder)
        }
    }
}
