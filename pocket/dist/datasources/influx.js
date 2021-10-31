"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAPI = exports.influxClient = void 0;
const influxdb_client_1 = require("@influxdata/influxdb-client");
exports.influxClient = new influxdb_client_1.InfluxDB({ url: "http://localhost:8086", token: "-QVD3pKtY_ZBdfLZYxclSA6frrzMVEaPqLlNY93dQbFSkO6RLJ-HsbA8X22xwzTaEGSlRqgaZYCBIyUwOzd-QA==" });
exports.writeAPI = exports.influxClient.getWriteApi("nachonodes", "nodes");
//# sourceMappingURL=influx.js.map