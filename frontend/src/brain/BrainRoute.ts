import { CheckHealthData, TestDatabaseData, TestDatabaseRequest } from "./data-contracts";

export namespace Brain {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  export namespace check_health {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = CheckHealthData;
  }

  /**
   * @description Test the connection to Firebase Realtime Database by reading from a specific path.
   * @tags dbtn/module:firebase, dbtn/hasAuth
   * @name test_database
   * @summary Test Database
   * @request POST:/routes/test-database
   */
  export namespace test_database {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = TestDatabaseRequest;
    export type RequestHeaders = {};
    export type ResponseBody = TestDatabaseData;
  }
}
