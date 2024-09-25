/* tslint:disable */
/* eslint-disable */
/**
 * Ctrlplane API
 * No description provided (generated by Openapi Generator https://github.com/openapitools/openapi-generator)
 *
 * The version of the OpenAPI document: 1.0.0
 *
 *
 * NOTE: This class is auto generated by OpenAPI Generator (https://openapi-generator.tech).
 * https://openapi-generator.tech
 * Do not edit the class manually.
 */

import { mapValues } from "../runtime";

/**
 *
 * @export
 * @interface GetJob200ResponseEnvironment
 */
export interface GetJob200ResponseEnvironment {
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseEnvironment
   */
  id: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseEnvironment
   */
  name: string;
  /**
   *
   * @type {string}
   * @memberof GetJob200ResponseEnvironment
   */
  systemId: string;
}

/**
 * Check if a given object implements the GetJob200ResponseEnvironment interface.
 */
export function instanceOfGetJob200ResponseEnvironment(
  value: object,
): value is GetJob200ResponseEnvironment {
  if (!("id" in value) || value["id"] === undefined) return false;
  if (!("name" in value) || value["name"] === undefined) return false;
  if (!("systemId" in value) || value["systemId"] === undefined) return false;
  return true;
}

export function GetJob200ResponseEnvironmentFromJSON(
  json: any,
): GetJob200ResponseEnvironment {
  return GetJob200ResponseEnvironmentFromJSONTyped(json, false);
}

export function GetJob200ResponseEnvironmentFromJSONTyped(
  json: any,
  ignoreDiscriminator: boolean,
): GetJob200ResponseEnvironment {
  if (json == null) {
    return json;
  }
  return {
    id: json["id"],
    name: json["name"],
    systemId: json["systemId"],
  };
}

export function GetJob200ResponseEnvironmentToJSON(
  value?: GetJob200ResponseEnvironment | null,
): any {
  if (value == null) {
    return value;
  }
  return {
    id: value["id"],
    name: value["name"],
    systemId: value["systemId"],
  };
}
