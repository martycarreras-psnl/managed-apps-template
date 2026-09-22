"""One-off: create the cr922_managedappinventory table in Dataverse.

Emits the EntityDefinitions POST body consumed by `dataverse api request --body-file`.
Not part of the app runtime.
"""

import json

PREFIX = "cr922"


def label(text):
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.Label",
        "LocalizedLabels": [
            {
                "@odata.type": "Microsoft.Dynamics.CRM.LocalizedLabel",
                "Label": text,
                "LanguageCode": 1033,
            }
        ],
    }


def string_col(name, display, max_length):
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.StringAttributeMetadata",
        "AttributeType": "String",
        "AttributeTypeName": {"Value": "StringType"},
        "SchemaName": f"{PREFIX}_{name}",
        "DisplayName": label(display),
        "RequiredLevel": {"Value": "None"},
        "FormatName": {"Value": "Text"},
        "MaxLength": max_length,
    }


def memo_col(name, display, max_length):
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.MemoAttributeMetadata",
        "AttributeType": "Memo",
        "AttributeTypeName": {"Value": "MemoType"},
        "SchemaName": f"{PREFIX}_{name}",
        "DisplayName": label(display),
        "RequiredLevel": {"Value": "None"},
        "MaxLength": max_length,
    }


def bool_col(name, display, true_label, false_label):
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.BooleanAttributeMetadata",
        "AttributeType": "Boolean",
        "AttributeTypeName": {"Value": "BooleanType"},
        "SchemaName": f"{PREFIX}_{name}",
        "DisplayName": label(display),
        "RequiredLevel": {"Value": "None"},
        "DefaultValue": False,
        "OptionSet": {
            "@odata.type": "Microsoft.Dynamics.CRM.BooleanOptionSetMetadata",
            "TrueOption": {"Value": 1, "Label": label(true_label)},
            "FalseOption": {"Value": 0, "Label": label(false_label)},
        },
    }


def choice_col(name, display, options):
    return {
        "@odata.type": "Microsoft.Dynamics.CRM.PicklistAttributeMetadata",
        "AttributeType": "Picklist",
        "AttributeTypeName": {"Value": "PicklistType"},
        "SchemaName": f"{PREFIX}_{name}",
        "DisplayName": label(display),
        "RequiredLevel": {"Value": "None"},
        "OptionSet": {
            "@odata.type": "Microsoft.Dynamics.CRM.OptionSetMetadata",
            "IsGlobal": False,
            "OptionSetType": "Picklist",
            "Options": [
                {"Value": value, "Label": label(text)} for value, text in options
            ],
        },
    }


DATA_SOURCES = [
    (100000000, "Dataverse"),
    (100000001, "SharePoint"),
    (100000002, "Excel Online"),
    (100000003, "Office 365 Outlook"),
    (100000004, "Teams"),
    (100000005, "OneDrive"),
    (100000006, "Azure DevOps"),
    (100000007, "Copilot Studio"),
    (100000008, "Work IQ"),
    (100000009, "None / Local"),
]

STATUSES = [
    (100000000, "Draft"),
    (100000001, "Local dev"),
    (100000002, "Deployed"),
]

primary = string_col("appname", "App Name", 200)
primary["IsPrimaryName"] = True

entity = {
    "@odata.type": "Microsoft.Dynamics.CRM.EntityMetadata",
    "SchemaName": f"{PREFIX}_ManagedAppInventory",
    "DisplayName": label("Managed App Inventory"),
    "DisplayCollectionName": label("Managed App Inventory"),
    "Description": label(
        "Inventory of Microsoft Apps created through the Managed Apps CLI."
    ),
    "OwnershipType": "UserOwned",
    "IsActivity": False,
    "HasNotes": False,
    "HasActivities": False,
    "PrimaryNameAttribute": f"{PREFIX}_appname",
    "Attributes": [
        primary,
        memo_col("description", "Description", 2000),
        memo_col("valueprovided", "Value Provided", 2000),
        bool_col("shared", "Shared", "Yes", "No"),
        string_col("sharedwith", "Shared With", 400),
        choice_col("coredatasource", "Core Data Source", DATA_SOURCES),
        choice_col("status", "Status", STATUSES),
        string_col("appguid", "App GUID", 100),
        string_col("environment", "Environment", 200),
        memo_col("notes", "Notes", 4000),
    ],
}

with open("scripts/table-body.json", "w") as handle:
    json.dump(entity, handle, indent=2)

print(f"Wrote scripts/table-body.json ({len(entity['Attributes'])} columns)")
