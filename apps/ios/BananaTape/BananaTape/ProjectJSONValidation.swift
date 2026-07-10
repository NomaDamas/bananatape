import Foundation

enum ProjectJSONValidation {
    static func manifestSummary(from data: Data) -> MobileProjectSummary? {
        guard
            let object = try? JSONSerialization.jsonObject(with: data),
            let record = object as? [String: Any],
            let schemaVersion = record["schemaVersion"] as? Int,
            schemaVersion == 1,
            let id = record["id"] as? String,
            let name = record["name"] as? String,
            record["createdAt"] is String,
            record["updatedAt"] is String
        else {
            return nil
        }
        return MobileProjectSummary(id: id, name: name)
    }

    static func historyIsValid(_ data: Data) -> Bool {
        guard
            let object = try? JSONSerialization.jsonObject(with: data),
            let record = object as? [String: Any],
            let schemaVersion = record["schemaVersion"] as? Int,
            schemaVersion == 1,
            record["revision"] as? Int != nil,
            record["entries"] is [Any]
        else {
            return false
        }
        return true
    }
}
