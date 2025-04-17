import { CheckHealthData, TestDatabaseData, TestDatabaseError, TestDatabaseRequest } from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Brain<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   *
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  check_health = (params: RequestParams = {}) =>
    this.request<CheckHealthData, any>({
      path: `/_healthz`,
      method: "GET",
      ...params,
    });

  /**
   * @description Test the connection to Firebase Realtime Database by reading from a specific path.
   *
   * @tags dbtn/module:firebase, dbtn/hasAuth
   * @name test_database
   * @summary Test Database
   * @request POST:/routes/test-database
   */
  test_database = (data: TestDatabaseRequest, params: RequestParams = {}) =>
    this.request<TestDatabaseData, TestDatabaseError>({
      path: `/routes/test-database`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });
}
